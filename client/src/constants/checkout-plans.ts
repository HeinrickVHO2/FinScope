import { BILLING_PLAN_ORDER, BILLING_PLANS, type BillingPlanId } from "@shared/plans";

export const CHECKOUT_PLAN_OPTIONS = BILLING_PLAN_ORDER.map((planId) => {
  const plan = BILLING_PLANS[planId];
  return {
    id: plan.id,
    name: plan.name,
    shortName: plan.shortName,
    price: plan.priceLabel,
    description: plan.description,
    badge: plan.badge,
    recommended: Boolean(plan.recommended),
    marketingHeadline: plan.marketingHeadline,
    comparisonSummary: plan.comparisonSummary,
    features: plan.features,
    modalHighlights: plan.modalHighlights,
    commercialCopy: plan.commercialCopy,
  };
}) as const;

export type CheckoutPlanId = BillingPlanId;
