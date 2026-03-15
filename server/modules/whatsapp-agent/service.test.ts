import test from "node:test";
import assert from "node:assert/strict";
import { WhatsAppAgentService } from "./service";
import type { WhatsAppInboundEvent } from "./types";

class FakeRepository {
  public inboundCounter = 0;
  public candidates: any[] = [];
  public inboundStatus: string | null = null;

  async bindPhone() {
    return { id: "bind-1", phone_e164: "+5511999999999", provider: "mock", is_verified: true };
  }

  async getBindingByUser() {
    return { id: "bind-1", phone_e164: "+5511999999999", provider: "mock", is_verified: true };
  }

  async listCandidatesByUser() {
    return [];
  }

  async getCandidateById() {
    return null;
  }

  async updateCandidate() {
    return;
  }

  async findInboundByProviderMessageId() {
    return null;
  }

  async findUserByPhone() {
    return "user-1";
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
    this.candidates.push(payload);
    return payload;
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

test("WhatsAppAgentService auto-confirms high confidence message", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new WhatsAppAgentService(repository as any, storage as any);

  const result = await service.processInboundEvent(baseEvent);

  assert.equal(result.status, "auto_confirmed");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(repository.inboundStatus, "auto_confirmed");
  assert.equal(repository.candidates[0].status, "confirmed");
});

test("WhatsAppAgentService sends ambiguous message to pending review", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const service = new WhatsAppAgentService(repository as any, storage as any);

  const result = await service.processInboundEvent({
    ...baseEvent,
    providerMessageId: "provider-msg-2",
    text: "essa nota é da farmácia",
  });

  assert.equal(result.status, "pending_review");
  assert.equal(storage.createTransactionCalls, 0);
  assert.equal(repository.inboundStatus, "pending_review");
  assert.equal(repository.candidates[0].status, "pending_review");
});

