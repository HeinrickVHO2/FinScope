import test from "node:test";
import assert from "node:assert/strict";
import { WhatsAppAgentService } from "./service";
import type { WhatsAppInboundEvent } from "./types";

class FakeRepository {
  public inboundCounter = 0;
  public candidateCounter = 0;
  public bindings = new Map<string, any>();
  public candidates = new Map<string, any>();
  public inboundStatus: string | null = null;

  async getBindingByUser(userId: string) {
    return this.bindings.get(userId) || null;
  }

  async getBindingByPhone(phone: string) {
    return Array.from(this.bindings.values()).find((binding) => binding.phone_e164 === phone) || null;
  }

  async saveVerifiedBinding(params: { userId: string; phone: string; provider?: string }) {
    const binding = {
      id: "bind-1",
      user_id: params.userId,
      phone_e164: params.phone,
      provider: params.provider || "mock",
      is_verified: true,
    };
    this.bindings.set(params.userId, binding);
    return binding;
  }

  async deleteBindingByUser(userId: string) {
    this.bindings.delete(userId);
  }

  async listCandidatesByUser() {
    return Array.from(this.candidates.values());
  }

  async getCandidateById(candidateId: string) {
    return this.candidates.get(candidateId) || null;
  }

  async updateCandidate(payload: any) {
    const current = this.candidates.get(payload.candidateId);
    this.candidates.set(payload.candidateId, { ...current, status: payload.status, persisted_transaction_id: payload.persistedTransactionId ?? current?.persisted_transaction_id ?? null });
  }

  async findInboundByProviderMessageId() {
    return null;
  }

  async findUserByPhone(phone: string) {
    return Array.from(this.bindings.values()).find((binding) => binding.phone_e164 === phone)?.user_id || null;
  }

  async createInboundMessage(_: any) {
    this.inboundCounter += 1;
    return {
      id: `in-${this.inboundCounter}`,
      providerMessageId: `msg-${this.inboundCounter}`,
      userId: "user-1",
      fromPhone: "+5511999999999",
      type: "text",
      status: "received",
      extractedPayload: null,
    };
  }

  async createMediaEvidence() {
    return;
  }

  async createCandidate(payload: any) {
    this.candidateCounter += 1;
    const candidate = {
      id: `candidate-${this.candidateCounter}`,
      inbound_message_id: payload.inboundMessageId,
      proposed_type: payload.kind,
      amount: payload.amount,
      description: payload.description,
      category_suggestion: payload.categorySuggestion ?? null,
      transaction_date: payload.transactionDate.toISOString(),
      confidence_score: payload.confidenceScore,
      status: payload.status,
      persisted_transaction_id: payload.persistedTransactionId ?? null,
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async updateInboundMessage(payload: any) {
    this.inboundStatus = payload.status;
    return;
  }

  async appendProcessingLog() {
    return;
  }
}

class FakeStorage {
  public createTransactionCalls = 0;

  async getUser(userId: string) {
    return {
      id: userId,
      email: "user@example.com",
      password: "hashed",
      fullName: "Teste",
      plan: "pro",
      trialStart: null,
      trialEnd: null,
      caktoSubscriptionId: "sub-1",
      billingStatus: "active",
      createdAt: new Date(),
    };
  }

  async getAccount(accountId: string) {
    return {
      id: accountId,
      userId: "user-1",
      name: "Conta Principal",
      type: "pf",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    };
  }

  async getAccountsByUserId() {
    return [
      {
        id: "acc-1",
        userId: "user-1",
        name: "Conta Principal",
        type: "pf",
        businessCategory: null,
        initialBalance: "0",
        createdAt: new Date(),
      },
    ];
  }

  async createTransaction(_: any) {
    this.createTransactionCalls += 1;
    return {
      id: `tx-${this.createTransactionCalls}`,
      userId: "user-1",
      accountId: "acc-1",
      description: "mock",
      type: "saida",
      amount: "10.00",
      category: "Outros",
      date: new Date(),
      accountType: "PF",
      autoRuleApplied: false,
      source: "whatsapp_agent",
      createdAt: new Date(),
    };
  }
}

const baseEvent: WhatsAppInboundEvent = {
  provider: "mock",
  providerMessageId: "provider-msg-1",
  fromPhone: "+55 (11) 99999-9999",
  type: "text",
  text: "gastei 42 com gasolina",
  rawPayload: {},
};

test("WhatsAppAgentService confirms binding when code arrives from the informed phone", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new WhatsAppAgentService(repository as any, storage as any);

  const binding = await service.startBinding("user-1", "+55 11 99999-9999");
  const result = await service.processInboundEvent({
    ...baseEvent,
    providerMessageId: "provider-msg-binding",
    text: binding.code,
  });

  assert.equal(result.status, "binding_confirmed");
  assert.equal(repository.bindings.get("user-1")?.phone_e164, "+5511999999999");
});

test("WhatsAppAgentService creates pending candidate for linked phone message", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new WhatsAppAgentService(repository as any, storage as any);

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(baseEvent);

  assert.equal(result.status, "pending_review");
  assert.equal(storage.createTransactionCalls, 0);
  assert.equal(repository.inboundStatus, "pending_review");
  assert.equal(Array.from(repository.candidates.values())[0]?.status, "pending_review");
});

test("WhatsAppAgentService confirms candidate into transaction", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new WhatsAppAgentService(repository as any, storage as any);

  repository.candidates.set("candidate-1", {
    id: "candidate-1",
    inbound_message_id: "in-1",
    proposed_type: "expense",
    amount: 89.9,
    description: "gastei 89,90 no mercado",
    category_suggestion: "Alimentação",
    transaction_date: "2026-03-15T00:00:00.000Z",
    status: "pending_review",
    persisted_transaction_id: null,
  });

  const result = await service.confirmCandidate({
    userId: "user-1",
    candidateId: "candidate-1",
    accountId: "acc-1",
  });

  assert.equal(result.transactionId, "tx-1");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(repository.candidates.get("candidate-1")?.status, "confirmed");
});
