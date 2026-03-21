export type BillingPlanId = "pro" | "premium";

export type InternalAiMode = "basic" | "advanced";

export type BillingPlanFeatureFlags = {
  businessArea: boolean;
  whatsappAgent: boolean;
  basicPdf: boolean;
  advancedPdf: boolean;
  aiBasic: boolean;
  aiAdvanced: boolean;
  aiReports: boolean;
};

export type BillingPlanConfig = {
  id: BillingPlanId;
  name: string;
  shortName: string;
  priceCents: number;
  priceLabel: string;
  monthlyLabel: string;
  description: string;
  marketingHeadline: string;
  recommended?: boolean;
  badge?: string;
  accountsLimit: number;
  checkout: {
    productEnvKeys: string[];
    checkoutUrlEnvKey: string;
  };
  features: string[];
  modalHighlights: string[];
  comparisonSummary: string;
  commercialCopy: {
    dailyPriceLabel?: string;
    priceSupport: string;
    checkoutSupport: string;
    upsellSupport: string;
  };
  featureFlags: BillingPlanFeatureFlags;
};

const formatPriceLabel = (priceCents: number) =>
  `R$ ${(priceCents / 100).toFixed(2).replace(".", ",")}/mes`;

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanConfig> = {
  pro: {
    id: "pro",
    name: "Plano Pro",
    shortName: "Pro",
    priceCents: 1990,
    priceLabel: formatPriceLabel(1990),
    monthlyLabel: "R$ 19,90/mes",
    description: "Controle essencial com IA basica para registrar gastos, entradas e acompanhar sua rotina com clareza.",
    marketingHeadline: "Controle essencial com IA basica",
    accountsLimit: 3,
    checkout: {
      productEnvKeys: ["CAKTO_PRODUCT_PRO_ID", "CAKTO_PLAN_PRO_ID"],
      checkoutUrlEnvKey: "CAKTO_CHECKOUT_PRO_URL",
    },
    features: [
      "Conta pessoal com controle essencial",
      "Painel financeiro completo",
      "IA basica para registrar gastos e entradas",
      "Resumos financeiros genericos para acompanhar o mes",
      "Relatorio PDF basico",
    ],
    modalHighlights: [
      "IA basica para registrar movimentacoes e resumir o mes",
      "PDF basico para acompanhar o historico",
      "Estrutura ideal para quem quer controle sem complexidade",
    ],
    comparisonSummary: "Ideal para organizar a operacao do dia a dia com controle essencial.",
    commercialCopy: {
      priceSupport: "Controle essencial para organizar sua rotina financeira com praticidade.",
      checkoutSupport: "Organize gastos, entradas e resumos do mes sem adicionar complexidade.",
      upsellSupport: "Boa escolha para quem quer clareza e rotina financeira bem organizada.",
    },
    featureFlags: {
      businessArea: false,
      whatsappAgent: false,
      basicPdf: true,
      advancedPdf: false,
      aiBasic: true,
      aiAdvanced: false,
      aiReports: false,
    },
  },
  premium: {
    id: "premium",
    name: "Plano Premium",
    shortName: "Premium",
    priceCents: 3990,
    priceLabel: formatPriceLabel(3990),
    monthlyLabel: "R$ 39,90/mes",
    description: "Automacao, relatorios avancados e inteligencia ampliada para quem quer menos trabalho manual e mais visibilidade financeira.",
    marketingHeadline: "Automacao, relatorios avancados e inteligencia ampliada",
    recommended: true,
    badge: "Mais popular",
    accountsLimit: Number.POSITIVE_INFINITY,
    checkout: {
      productEnvKeys: ["CAKTO_PRODUCT_PREMIUM_ID", "CAKTO_PLAN_PREMIUM_ID"],
      checkoutUrlEnvKey: "CAKTO_CHECKOUT_PREMIUM_URL",
    },
    features: [
      "Operacao mais automatizada",
      "Minha empresa com visao dedicada",
      "Agent de WhatsApp exclusivo para registrar pelo chat",
      "IA avancada com analises, interpretacoes e insights premium",
      "Relatorios PDF avancados, mais completos e profissionais",
    ],
    modalHighlights: [
      "Relatorios mais completos, prontos para compartilhar",
      "Agent de WhatsApp exclusivo para automacao de lancamentos",
      "IA com analises mais uteis, dicas e interpretacoes avancadas",
    ],
    comparisonSummary: "Ideal para quem quer operacao mais automatizada e leitura financeira mais profunda.",
    commercialCopy: {
      dailyPriceLabel: "Menos de R$ 1,33 por dia",
      priceSupport: "Mais automacao para sua rotina financeira por um custo baixo no dia a dia.",
      checkoutSupport: "Por cerca de R$ 1,33 por dia, voce libera WhatsApp, relatorios avancados e menos trabalho manual.",
      upsellSupport: "Automatize registros, ganhe relatorios mais completos e tenha uma experiencia mais inteligente no dia a dia.",
    },
    featureFlags: {
      businessArea: true,
      whatsappAgent: true,
      basicPdf: false,
      advancedPdf: true,
      aiBasic: true,
      aiAdvanced: true,
      aiReports: true,
    },
  },
};

export const BILLING_PLAN_ORDER: BillingPlanId[] = ["pro", "premium"];

export function isBillingPlanId(value: string | null | undefined): value is BillingPlanId {
  return value === "pro" || value === "premium";
}

export function normalizeBillingPlan(value: string | null | undefined): BillingPlanId {
  return isBillingPlanId(value) ? value : "pro";
}

export function getBillingPlan(value: string | null | undefined): BillingPlanConfig {
  return BILLING_PLANS[normalizeBillingPlan(value)];
}

export function getAvailableCheckoutPlans(currentPlan?: string | null) {
  const normalizedCurrentPlan = isBillingPlanId(currentPlan) ? currentPlan : null;
  return BILLING_PLAN_ORDER
    .map((planId) => BILLING_PLANS[planId])
    .filter((plan) => plan.id !== normalizedCurrentPlan);
}

export function canUseBusinessArea(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.businessArea;
}

export function canUseWhatsAppAgent(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.whatsappAgent;
}

export function canUseBasicPdf(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.basicPdf;
}

export function canUseAdvancedPdf(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.advancedPdf;
}

export function canUseBasicInternalAi(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.aiBasic;
}

export function canUseAdvancedInternalAi(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.aiAdvanced;
}

export function canUseAiReports(plan?: string | null) {
  return getBillingPlan(plan).featureFlags.aiReports;
}

export function getInternalAiMode(plan?: string | null): InternalAiMode {
  return canUseAdvancedInternalAi(plan) ? "advanced" : "basic";
}
