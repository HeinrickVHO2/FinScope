import test from "node:test";
import assert from "node:assert/strict";
import { WhatsAppAgentService } from "./service";
import type { WhatsAppInboundEvent } from "./types";

class FakeRepository {
  public inboundCounter = 0;
  public candidateCounter = 0;
  public mediaCounter = 0;
  public appendProcessingLogCalls = 0;
  public bindings = new Map<string, any>();
  public inboundMessages = new Map<string, any>();
  public candidates = new Map<string, any>();
  public mediaEvidence: any[] = [];

  async getBindingByUser(userId: string) {
    return this.bindings.get(userId) || null;
  }

  async getBindingByPhone(phone: string) {
    return Array.from(this.bindings.values()).find((binding) => binding.phone_e164 === phone) || null;
  }

  async saveVerifiedBinding(params: { userId: string; phone: string; provider?: string }) {
    const binding = {
      id: `bind-${params.userId}`,
      user_id: params.userId,
      phone_e164: params.phone,
      provider: params.provider || "mock",
      is_verified: true,
      updated_at: new Date().toISOString(),
    };
    this.bindings.set(params.userId, binding);
    return binding;
  }

  async deleteBindingByUser(userId: string) {
    this.bindings.delete(userId);
  }

  async findInboundByProviderMessageId(providerMessageId: string) {
    return Array.from(this.inboundMessages.values()).find((item) => item.providerMessageId === providerMessageId) || null;
  }

  async findUserByPhone(phone: string) {
    return Array.from(this.bindings.values()).find((binding) => binding.phone_e164 === phone)?.user_id || null;
  }

  async createInboundMessage(params: any) {
    this.inboundCounter += 1;
    const inbound = {
      id: `in-${this.inboundCounter}`,
      providerMessageId: params.event.providerMessageId,
      userId: params.userId,
      fromPhone: params.event.fromPhone,
      type: params.event.type,
      status: params.status,
      textBody: params.event.text ?? null,
      extractedPayload: params.extractedPayload ?? null,
      receivedAt: params.event.timestamp ?? new Date().toISOString(),
      errorMessage: params.errorMessage ?? null,
      confidenceScore: params.confidenceScore ?? null,
    };
    this.inboundMessages.set(inbound.id, inbound);
    return inbound;
  }

  async updateInboundMessage(params: any) {
    const current = this.inboundMessages.get(params.id);
    this.inboundMessages.set(params.id, {
      ...current,
      status: params.status,
      extractedPayload: params.extractedPayload ?? current?.extractedPayload ?? null,
      confidenceScore: params.confidenceScore ?? current?.confidenceScore ?? null,
      errorMessage: params.errorMessage ?? current?.errorMessage ?? null,
    });
  }

  async createCandidate(payload: any) {
    this.candidateCounter += 1;
    const candidate = {
      id: `candidate-${this.candidateCounter}`,
      user_id: payload.userId,
      inbound_message_id: payload.inboundMessageId,
      proposed_type: payload.kind,
      amount: payload.amount,
      currency: payload.currency,
      description: payload.description,
      merchant_name: payload.merchant ?? null,
      category_suggestion: payload.categorySuggestion ?? null,
      transaction_date: payload.transactionDate.toISOString(),
      confidence_score: payload.confidenceScore,
      status: payload.status,
      evidence: payload.evidence ?? null,
      persisted_transaction_id: payload.persistedTransactionId ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async listCandidatesByStatuses(userId: string, statuses: string[]) {
    return Array.from(this.candidates.values())
      .filter((candidate) => candidate.user_id === userId)
      .filter((candidate) => !statuses.length || statuses.includes(candidate.status))
      .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
  }

  async getLatestCandidateByUser(userId: string, statuses: string[]) {
    return (await this.listCandidatesByStatuses(userId, statuses))[0] || null;
  }

  async getCandidateById(candidateId: string, userId: string) {
    const candidate = this.candidates.get(candidateId) || null;
    if (!candidate || candidate.user_id !== userId) return null;
    return candidate;
  }

  async updateCandidate(payload: any) {
    const current = this.candidates.get(payload.candidateId);
    this.candidates.set(payload.candidateId, {
      ...current,
      status: payload.status ?? current?.status,
      description: payload.description ?? current?.description,
      amount: payload.amount ?? current?.amount,
      merchant_name: payload.merchantName ?? current?.merchant_name ?? null,
      category_suggestion: payload.categorySuggestion ?? current?.category_suggestion ?? null,
      transaction_date: payload.transactionDate ? payload.transactionDate.toISOString() : current?.transaction_date,
      confidence_score: payload.confidenceScore ?? current?.confidence_score ?? null,
      evidence: payload.evidence ?? current?.evidence ?? null,
      persisted_transaction_id: payload.persistedTransactionId !== undefined
        ? payload.persistedTransactionId
        : current?.persisted_transaction_id ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  async createMediaEvidence(payload: any) {
    this.mediaCounter += 1;
    this.mediaEvidence.push({
      id: `media-${this.mediaCounter}`,
      inbound_message_id: payload.inboundMessageId,
      user_id: payload.userId,
      media_type: payload.mediaType,
      mime_type: payload.mimeType ?? null,
      storage_path: payload.storagePath,
      sha256: payload.sha256,
      file_size_bytes: payload.fileSizeBytes ?? null,
      ocr_text: payload.ocrText ?? null,
      ocr_confidence: payload.ocrConfidence ?? null,
      status: payload.status,
      created_at: new Date().toISOString(),
    });
  }

  async getInboundMessagesByIds(ids: string[]) {
    return ids.map((id) => this.inboundMessages.get(id)).filter(Boolean);
  }

  async listMediaEvidenceByInboundIds(ids: string[]) {
    return this.mediaEvidence.filter((item) => ids.includes(item.inbound_message_id));
  }

  async appendProcessingLog() {
    this.appendProcessingLogCalls += 1;
    return true;
  }
}

class FakeStorage {
  public createTransactionCalls = 0;
  public updateTransactionCalls = 0;
  public deleteTransactionCalls = 0;
  public failCreateTransaction = false;
  public transactions = new Map<string, any>();
  public accounts = [
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
    return this.accounts.find((account) => account.id === accountId);
  }

  async getAccountsByUserId(userId: string) {
    return this.accounts.filter((account) => account.userId === userId);
  }

  async getTransaction(id: string) {
    return this.transactions.get(id);
  }

  async getTransactionsByUserId(userId: string, scope: "PF" | "PJ" | "ALL" = "ALL") {
    return Array.from(this.transactions.values()).filter((item) => {
      if (item.userId !== userId) return false;
      if (scope === "ALL") return true;
      return (item.accountType || "PF") === scope;
    });
  }

  async createTransaction(payload: any) {
    if (this.failCreateTransaction) {
      throw new Error("create_transaction_failed_for_test");
    }
    this.createTransactionCalls += 1;
    const transaction = {
      id: `tx-${this.createTransactionCalls}`,
      userId: payload.userId,
      accountId: payload.accountId,
      description: payload.description,
      type: payload.type,
      amount: String(payload.amount.toFixed(2)),
      category: payload.category,
      date: payload.date,
      accountType: payload.accountType,
      autoRuleApplied: false,
      source: payload.source || "manual",
      createdAt: new Date(),
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async updateTransaction(id: string, patch: any) {
    const current = this.transactions.get(id);
    if (!current) return undefined;
    this.updateTransactionCalls += 1;
    const updated = {
      ...current,
      description: patch.description ?? current.description,
      amount: patch.amount !== undefined ? String(Number(patch.amount).toFixed(2)) : current.amount,
      category: patch.category ?? current.category,
      date: patch.date ?? current.date,
      type: patch.type ?? current.type,
      accountType: patch.accountType ?? current.accountType,
      source: patch.source ?? current.source,
    };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string) {
    this.deleteTransactionCalls += 1;
    return this.transactions.delete(id);
  }

  async getDashboardMetrics(userId: string, scope: "PF" | "PJ" | "ALL" = "ALL") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const transactions = await this.getTransactionsByUserId(userId, scope);
    const monthTransactions = transactions.filter((item) => item.date >= start && item.date < end);
    const monthlyIncome = monthTransactions
      .filter((item) => item.type === "entrada")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const monthlyExpenses = monthTransactions
      .filter((item) => item.type === "saida")
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      totalBalance: monthlyIncome - monthlyExpenses,
      monthlyIncome,
      monthlyExpenses,
      netCashFlow: monthlyIncome - monthlyExpenses,
    };
  }
}

class FakeMessenger {
  public sentMessages: Array<{ phone: string; text: string }> = [];

  async sendTextMessage(phone: string, text: string) {
    this.sentMessages.push({ phone, text });
    return true;
  }
}

class FakeMediaService {
  async prepareMedia(media: any) {
    return {
      mimeType: media.mimeType || "image/jpeg",
      base64: media.base64 || "aGVsbG8=",
      storagePath: media.url || `inline://${media.id}`,
      fileSizeBytes: 128,
      textHint: "",
    };
  }
}

function buildParser(results: any[]) {
  let index = 0;
  return {
    parse() {
      const current = results[Math.min(index, results.length - 1)];
      index += 1;
      return current;
    },
  };
}

function buildBaseEvent(overrides: Partial<WhatsAppInboundEvent> = {}): WhatsAppInboundEvent {
  return {
    provider: "mock",
    providerMessageId: `provider-${Date.now()}-${Math.random()}`,
    fromPhone: "+55 (11) 99999-9999",
    type: "text",
    text: "gastei 42 com gasolina",
    rawPayload: {},
    ...overrides,
  };
}

test("WhatsAppAgentService confirms binding when code arrives from the informed phone", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  const binding = await service.startBinding("user-1", "+55 11 99999-9999");
  assert.equal(repository.appendProcessingLogCalls, 0);

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-binding",
    text: binding.code,
  }));

  assert.equal(result.status, "binding_confirmed");
  assert.equal(repository.bindings.get("user-1")?.phone_e164, "+5511999999999");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Numero confirmado/i);
});

test("WhatsAppAgentService auto creates transaction for high confidence messages and exposes review item", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 42,
    description: "Gasolina",
    merchant: "Posto",
    categorySuggestion: "Transporte",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.93,
    missingFields: [],
  }]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-auto",
    text: "gastei 42 com gasolina",
  }));

  assert.equal(result.status, "auto_created_pending_review");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(repository.candidates.get("candidate-1")?.status, "auto_created_pending_review");
  assert.equal(storage.transactions.get("tx-1")?.source, "whatsapp_agent");

  const reviewItems = await service.listReviewItems("user-1");
  assert.equal(reviewItems.length, 1);
  assert.equal(reviewItems[0]?.transaction?.source, "whatsapp_agent");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Registrei/i);
});

test("WhatsAppAgentService processes the real whatsapp phrases used in the current flow", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const expense = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-real-expense",
    text: "Paguei uma coxinha de 10 reais",
  }));
  const income = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-real-income",
    text: "Recebi 300 reais de um amigo de presente de aniversario",
  }));
  const unknown = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-real-unknown",
    text: "Comprei uma mochila",
  }));
  const expense2 = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-real-expense-2",
    text: "paguei 50 reais de gasolina",
  }));

  assert.equal(expense.status, "auto_created_pending_review");
  assert.equal(income.status, "auto_created_pending_review");
  assert.equal(unknown.status, "needs_clarification");
  assert.equal(expense2.status, "auto_created_pending_review");
  assert.equal(storage.createTransactionCalls, 3);
});

test("WhatsAppAgentService auto creates and replies for a direct market expense phrase", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-market-expense",
    text: "Gastei 20 reais no mercado hoje!",
  }));

  assert.equal(result.status, "auto_created_pending_review");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(storage.transactions.get("tx-1")?.source, "whatsapp_agent");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Registrei/i);
});

test("WhatsAppAgentService asks for confirmation for medium confidence messages and confirms in chat", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 18,
    description: "Lanche",
    merchant: "Padaria",
    categorySuggestion: "Alimentacao",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.78,
    missingFields: [],
  }]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const first = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-confirm-1",
    text: "paguei 18 no lanche",
  }));

  assert.equal(first.status, "awaiting_user_confirmation");
  assert.equal(storage.createTransactionCalls, 0);
  assert.equal(repository.candidates.get("candidate-1")?.status, "awaiting_user_confirmation");

  const second = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-confirm-2",
    text: "sim",
  }));

  assert.equal(second.status, "confirmed_via_whatsapp");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(repository.candidates.get("candidate-1")?.status, "confirmed");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Confirmado/i);
});

test("WhatsAppAgentService treats 'registre' as a confirmation reply", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 18,
    description: "Lanche",
    merchant: "Padaria",
    categorySuggestion: "Alimentacao",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.78,
    missingFields: [],
  }]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const first = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-registre-1",
    text: "paguei 18 no lanche",
  }));
  const second = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-registre-2",
    text: "registre",
  }));

  assert.equal(first.status, "awaiting_user_confirmation");
  assert.equal(second.status, "confirmed_via_whatsapp");
  assert.equal(storage.createTransactionCalls, 1);
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Confirmado/i);
});

test("WhatsAppAgentService asks for more details for low confidence messages", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([
    {
      kind: "expense",
      amount: 10,
      description: "Coxinha",
      merchant: null,
      categorySuggestion: "Alimentacao",
      transactionDate: new Date("2026-03-15T00:00:00.000Z"),
      confidence: 0.55,
      missingFields: ["account"],
    },
    {
      kind: "expense",
      amount: 10,
      description: "Coxinha",
      merchant: "Lanchonete",
      categorySuggestion: "Alimentacao",
      transactionDate: new Date("2026-03-15T00:00:00.000Z"),
      confidence: 0.74,
      missingFields: [],
    },
  ]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const first = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-low-1",
    text: "coxinha 10",
  }));

  assert.equal(first.status, "needs_clarification");
  assert.equal(repository.candidates.get("candidate-1")?.status, "needs_clarification");
  assert.equal(storage.createTransactionCalls, 0);

  const second = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-low-2",
    text: "foi gasto pessoal",
  }));

  assert.equal(second.status, "awaiting_user_confirmation");
  assert.equal(repository.candidates.get("candidate-1")?.status, "awaiting_user_confirmation");
});

test("WhatsAppAgentService answers finance assistant questions in chat", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-assistant",
    text: "O que e reserva de emergencia?",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Reserva de emerg/i);
});

test("WhatsAppAgentService gives a practical answer for weekly saving guidance", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Mercado",
    type: "saida",
    amount: 120,
    category: "Alimentacao",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-week-guidance",
    text: "Como posso economizar mais durante a semana?",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /dia a dia|fim da semana/i);
  assert.doesNotMatch(messenger.sentMessages.at(-1)?.text || "", /Posso ajudar com resumo do mes/i);
});

test("WhatsAppAgentService answers day-to-day saving tips as assistant guidance", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Mercado",
    type: "saida",
    amount: 180,
    category: "Alimentacao",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-daily-guidance",
    text: "Me de dicas para economizar no dia a dia.",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /economizar|dia a dia|semana/i);
  assert.doesNotMatch(messenger.sentMessages.at(-1)?.text || "", /Nao consegui identificar o valor/i);
});

test("WhatsAppAgentService answers monthly summary questions with real user data", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Salario",
    type: "entrada",
    amount: 5000,
    category: "Salario",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });
  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Mercado",
    type: "saida",
    amount: 420,
    category: "Alimentacao",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });
  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Gasolina",
    type: "saida",
    amount: 180,
    category: "Transporte",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-summary",
    text: "Faca um resumo do meu mes",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /entraram R\$ 5\.000,00/i);
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Alimentacao/i);
});

test("WhatsAppAgentService answers category queries from current month data", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Mercado do bairro",
    type: "saida",
    amount: 200,
    category: "Alimentacao",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });
  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Padaria",
    type: "saida",
    amount: 50,
    category: "Alimentacao",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-category-question",
    text: "Quanto eu gastei com alimentacao esse mes?",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /R\$ 250,00/i);
});

test("WhatsAppAgentService answers capability fallback in chat", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-help",
    text: "o que voce faz?",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Posso registrar gastos e recebimentos/i);
});

test("WhatsAppAgentService answers simple greetings in chat", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-greeting",
    text: "ola",
  }));

  assert.equal(result.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Posso registrar gastos/i);
});

test("WhatsAppAgentService creates invoice suggestion from media and stores evidence", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const ocrProvider = {
    async extractText() {
      return {
        text: "SUPERMERCADO CENTRAL\n15/03/2026\nArroz 1 x 12,30 12,30\nFeijao 1 x 8,50 8,50\nTotal 20,80",
        confidence: 0.88,
      };
    },
  };
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
    ocrProvider: ocrProvider as any,
    mediaService: new FakeMediaService() as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-invoice",
    type: "image",
    text: "nota do mercado",
    media: [
      {
        id: "media-1",
        mimeType: "image/jpeg",
        base64: "aGVsbG8=",
      },
    ],
  }));

  assert.equal(result.status, "awaiting_user_confirmation");
  assert.equal(repository.mediaEvidence.length, 1);
  assert.equal(repository.candidates.get("candidate-1")?.evidence?.mode, "invoice");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Recebi sua nota/i);
});

test("WhatsAppAgentService ignores non-receipt OCR results instead of hallucinating invoice data", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const ocrProvider = {
    async extractText() {
      return {
        text: "JFIF ICC_PROFILE random bytes",
        confidence: 0.18,
        receiptDetected: false,
        structuredReceipt: null,
      };
    },
  };
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
    ocrProvider: ocrProvider as any,
    mediaService: new FakeMediaService() as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-non-receipt-image",
    type: "image",
    text: "",
    media: [
      {
        id: "media-2",
        mimeType: "image/jpeg",
        base64: "aGVsbG8=",
      },
    ],
  }));

  assert.equal(result.status, "needs_clarification");
  assert.equal(repository.candidates.size, 0);
  assert.match(messenger.sentMessages.at(-1)?.text || "", /nao consegui interpretar/i);
});

test("WhatsAppAgentService uses structured receipt OCR when invoice text is sparse", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const ocrProvider = {
    async extractText() {
      return {
        text: "",
        confidence: 0.89,
        receiptDetected: true,
        structuredReceipt: {
          merchant: "SUPERMERCADO TRIUNFO LTDA",
          total: 52.52,
          date: "14/03/2026",
          items: [
            { description: "File de Peito", quantity: 0.341, unitPrice: 19.99, totalPrice: 6.81 },
            { description: "Acougue Bovino", quantity: 1, unitPrice: 9.99, totalPrice: 9.99 },
          ],
        },
      };
    },
  };
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
    ocrProvider: ocrProvider as any,
    mediaService: new FakeMediaService() as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-structured-invoice",
    type: "image",
    text: "",
    media: [
      {
        id: "media-3",
        mimeType: "image/jpeg",
        base64: "aGVsbG8=",
      },
    ],
  }));

  assert.equal(result.status, "awaiting_user_confirmation");
  assert.equal(repository.candidates.size, 1);
  assert.match(messenger.sentMessages.at(-1)?.text || "", /52,52/i);
});

test("WhatsAppAgentService confirms invoice suggestion, persists whatsapp transaction and uses it in summary", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const ocrProvider = {
    async extractText() {
      return {
        text: "",
        confidence: 0.89,
        receiptDetected: true,
        structuredReceipt: {
          merchant: "SUPERMERCADO TRIUNFO LTDA",
          total: 52.52,
          date: "14/03/2026",
          items: [
            { description: "File de Peito", quantity: 0.341, unitPrice: 19.99, totalPrice: 6.81 },
            { description: "Acougue Bovino", quantity: 1, unitPrice: 9.99, totalPrice: 9.99 },
          ],
        },
      };
    },
  };
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    messenger: messenger as any,
    ocrProvider: ocrProvider as any,
    mediaService: new FakeMediaService() as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const first = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-structured-invoice-confirm-1",
    type: "image",
    text: "",
    media: [
      {
        id: "media-4",
        mimeType: "image/jpeg",
        base64: "aGVsbG8=",
      },
    ],
  }));

  const second = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-structured-invoice-confirm-2",
    text: "sim",
  }));

  assert.equal(first.status, "awaiting_user_confirmation");
  assert.equal(second.status, "confirmed_via_whatsapp");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(storage.transactions.get("tx-1")?.source, "whatsapp_agent");

  const summary = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-summary-after-invoice",
    text: "Me mostra meu resumo financeiro",
  }));

  assert.equal(summary.status, "assistant_answered");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /52,52/i);
  assert.match(messenger.sentMessages.at(-1)?.text || "", /Categoria com maior peso/i);
});

test("WhatsAppAgentService does not trap a new standalone transaction behind an older pending candidate", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 50,
    description: "Gasolina",
    merchant: "Posto",
    categorySuggestion: "Transporte",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.95,
    missingFields: [],
  }]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  repository.candidates.set("candidate-old", {
    id: "candidate-old",
    user_id: "user-1",
    inbound_message_id: "in-old",
    proposed_type: "expense",
    amount: 10,
    currency: "BRL",
    description: "Coxinha",
    merchant_name: "Padaria",
    category_suggestion: "Alimentacao",
    transaction_date: "2026-03-15T00:00:00.000Z",
    confidence_score: 0.78,
    status: "awaiting_user_confirmation",
    evidence: { rawMessage: "paguei 10 no lanche" },
    persisted_transaction_id: null,
    created_at: new Date("2026-03-15T10:00:00.000Z").toISOString(),
    updated_at: new Date("2026-03-15T10:00:00.000Z").toISOString(),
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-new-transaction",
    text: "paguei 50 reais de gasolina",
  }));

  assert.equal(result.status, "auto_created_pending_review");
  assert.equal(repository.candidates.get("candidate-old")?.status, "ignored");
  assert.equal(storage.createTransactionCalls, 1);
  assert.equal(repository.candidates.get("candidate-1")?.status, "auto_created_pending_review");
});

test("WhatsAppAgentService auto creates transaction with multiple accounts when recent history indicates the likely account", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 27,
    description: "Uber",
    merchant: "Uber",
    categorySuggestion: "Transporte",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.95,
    missingFields: [],
  }]);
  storage.accounts = [
    {
      id: "acc-1",
      userId: "user-1",
      name: "Carteira PF",
      type: "pf",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
    {
      id: "acc-2",
      userId: "user-1",
      name: "Nubank PF",
      type: "pf",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
    {
      id: "acc-3",
      userId: "user-1",
      name: "Caixa PJ",
      type: "pj",
      businessCategory: null,
      initialBalance: "0",
      createdAt: new Date(),
    },
  ];

  await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-2",
    description: "Transporte recente",
    type: "saida",
    amount: 80,
    category: "Transporte",
    date: new Date(),
    accountType: "PF",
    source: "manual",
  });

  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-history-account",
    text: "paguei 27 de uber",
  }));

  assert.equal(result.status, "auto_created_pending_review");
  assert.equal(storage.createTransactionCalls, 2);
  assert.equal(storage.transactions.get("tx-2")?.accountId, "acc-2");
  assert.equal(repository.candidates.get("candidate-1")?.evidence?.accountSelectionReason, "recent_history_default");
});

test("WhatsAppAgentService falls back to pending confirmation when auto transaction persistence fails", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  storage.failCreateTransaction = true;
  const messenger = new FakeMessenger();
  const parser = buildParser([{
    kind: "expense",
    amount: 50,
    description: "Gasolina",
    merchant: "Posto",
    categorySuggestion: "Transporte",
    transactionDate: new Date("2026-03-15T00:00:00.000Z"),
    confidence: 0.95,
    missingFields: [],
  }]);
  const service = new WhatsAppAgentService(repository as any, storage as any, {
    parser: parser as any,
    messenger: messenger as any,
  });

  await repository.saveVerifiedBinding({
    userId: "user-1",
    phone: "+5511999999999",
    provider: "mock",
  });

  const result = await service.processInboundEvent(buildBaseEvent({
    providerMessageId: "provider-create-failure",
    text: "gastei 50 reais de gasolina",
  }));

  assert.equal(result.status, "awaiting_user_confirmation");
  assert.equal(storage.createTransactionCalls, 0);
  assert.equal(repository.candidates.get("candidate-1")?.status, "awaiting_user_confirmation");
  assert.match(messenger.sentMessages.at(-1)?.text || "", /nao consegui registrar automaticamente agora/i);
});

test("WhatsAppAgentService updates and removes auto created review transactions", async () => {
  const repository = new FakeRepository();
  const storage = new FakeStorage();
  const messenger = new FakeMessenger();
  const service = new WhatsAppAgentService(repository as any, storage as any, { messenger: messenger as any });

  const transaction = await storage.createTransaction({
    userId: "user-1",
    accountId: "acc-1",
    description: "Compra no mercado",
    type: "saida",
    amount: 84.3,
    category: "Alimentacao",
    date: new Date("2026-03-15T00:00:00.000Z"),
    accountType: "PF",
    source: "whatsapp_agent",
  });

  repository.candidates.set("candidate-1", {
    id: "candidate-1",
    user_id: "user-1",
    inbound_message_id: "in-1",
    proposed_type: "expense",
    amount: 84.3,
    currency: "BRL",
    description: "Compra no mercado",
    merchant_name: "Supermercado Central",
    category_suggestion: "Alimentacao",
    transaction_date: "2026-03-15T00:00:00.000Z",
    confidence_score: 0.9,
    status: "auto_created_pending_review",
    evidence: { selectedAccountId: "acc-1", selectedAccountLabel: "Conta Principal PF" },
    persisted_transaction_id: transaction.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  repository.inboundMessages.set("in-1", {
    id: "in-1",
    providerMessageId: "provider-review",
    userId: "user-1",
    fromPhone: "+5511999999999",
    type: "text",
    status: "auto_created_pending_review",
    textBody: "mercado 84,30",
    extractedPayload: null,
    receivedAt: new Date().toISOString(),
  });

  const updated = await service.updateReviewTransaction({
    userId: "user-1",
    candidateId: "candidate-1",
    patch: {
      description: "Compra de supermercado",
      amount: 80,
      category: "Supermercado",
      date: new Date("2026-03-16T00:00:00.000Z"),
    },
  });

  assert.equal(updated.transaction?.description, "Compra de supermercado");
  assert.equal(repository.candidates.get("candidate-1")?.status, "reviewed_corrected");

  const removed = await service.removeReviewTransaction({
    userId: "user-1",
    candidateId: "candidate-1",
  });

  assert.equal(removed.removed, true);
  assert.equal(storage.deleteTransactionCalls, 1);
  assert.equal(repository.candidates.get("candidate-1")?.status, "reviewed_removed");
});
