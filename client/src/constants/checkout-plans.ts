export const CHECKOUT_PLAN_OPTIONS = [
  {
    id: "pro",
    name: "Plano Pro",
    price: "R$ 19,90/mês",
    description: "Para quem precisa organizar as finanças com mais controle.",
    features: [
      "Até 3 contas",
      "Dashboard completo",
      "Alertas de pagamento",
      "Exportação PDF básico",
    ],
  },
  {
    id: "premium",
    name: "Plano Premium",
    price: "R$ 29,90/mês",
    description: "Tudo do Pro + recursos avançados para contas PJ.",
    badge: "Mais popular",
    features: [
      "Contas ilimitadas",
      "Categorização automática",
      "Relatórios avançados",
      "Gestão empresarial completa",
    ],
  },
] as const;

export type CheckoutPlanId = typeof CHECKOUT_PLAN_OPTIONS[number]["id"];
