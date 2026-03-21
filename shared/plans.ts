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
  featureFlags: BillingPlanFeatureFlags;
};

const formatPriceLabel = (priceCents: number) =>
  `R$ ${(priceCents / 100).toFixed(2).replace(".", ",")}/mês`;

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanConfig> = {
  pro: {
    id: "pro",
    name: "Plano Pro",
    shortName: "Pro",
    priceCents: 1990,
    priceLabel: formatPriceLabel(1990),
    monthlyLabel: "R$ 19,90/mês",
    description: "Controle essencial com IA básica para organizar a rotina financeira.",
    marketingHeadline: "Controle essencial com IA básica",
    accountsLimit: 3,
    checkout: {
      productEnvKeys: ["CAKTO_PRODUCT_PRO_ID", "CAKTO_PLAN_PRO_ID"],
      checkoutUrlEnvKey: "CAKTO_CHECKOUT_PRO_URL",
    },
    features: [
      "Até 3 contas",
      "Painel financeiro completo",
      "Assistente com IA para registrar gastos e entradas",
      "Resumos financeiros genéricos",
      "Relatório PDF básico",
    ],
    modalHighlights: [
      "IA básica para registrar movimentações e resumir o mês",
      "PDF básico para acompanhar o histórico",
      "Estrutura ideal para quem quer controle sem complexidade",
    ],
    comparisonSummary: "Ideal para organizar a operação do dia a dia com controle essencial.",
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
    monthlyLabel: "R$ 39,90/mês",
    description: "Automação, relatórios avançados e inteligência ampliada para a vida financeira e a sua empresa.",
    marketingHeadline: "Automação, relatórios avançados e inteligência ampliada",
    recommended: true,
    badge: "Mais recomendado",
    accountsLimit: Number.POSITIVE_INFINITY,
    checkout: {
      productEnvKeys: ["CAKTO_PRODUCT_PREMIUM_ID", "CAKTO_PLAN_PREMIUM_ID"],
      checkoutUrlEnvKey: "CAKTO_CHECKOUT_PREMIUM_URL",
    },
    features: [
      "Contas ilimitadas",
      "Minha empresa com visão dedicada",
      "Agent de WhatsApp",
      "Assistente com IA avançada e insights premium",
      "Relatórios PDF avançados",
    ],
    modalHighlights: [
      "Relatórios mais completos, prontos para compartilhar",
      "Agent de WhatsApp exclusivo para automação de lançamentos",
      "IA com análises mais úteis, dicas e interpretações avançadas",
    ],
    comparisonSummary: "Ideal para quem quer operação mais automatizada e leitura financeira mais profunda.",
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
