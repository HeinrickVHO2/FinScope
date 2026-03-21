export const CHECKOUT_PLAN_OPTIONS = [
  {
    id: "pro",
    name: "Plano Pro",
    price: "R$ 19,90/mês",
    description: "Para quem precisa organizar as finanças com mais controle.",
    badge: undefined,
    features: [
      "Até 3 contas",
      "Painel completo",
      "Alertas de pagamento",
      "Exportação em PDF",
    ],
  },
  {
    id: "premium",
    name: "Plano Premium",
    price: "R$ 29,90/mês",
    description: "Tudo do Pro + recursos completos para a sua empresa.",
    badge: "Mais popular",
    features: [
      "Contas ilimitadas",
      "Organização automática das categorias",
      "Relatórios avançados",
      "Minha empresa com visão completa",
    ],
  },
] as const;

export type CheckoutPlanId = typeof CHECKOUT_PLAN_OPTIONS[number]["id"];
