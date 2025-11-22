import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FinScopeHeader } from "@/components/site/FinScopeHeader";
import { FinScopeFooter } from "@/components/site/FinScopeFooter";
import {
  TrendingUp,
  PieChart,
  Zap,
  Shield,
  BarChart3,
  Wallet,
  FileText,
  Check,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {

  const benefits = [
    {
      icon: PieChart,
      title: "Visão Completa das Finanças",
      description: "Dashboard intuitivo com gráficos em tempo real do seu dinheiro pessoal e empresarial."
    },
    {
      icon: Zap,
      title: "Categorização Automática",
      description: "Crie regras inteligentes para categorizar transações automaticamente e economizar tempo."
    },
    {
      icon: Shield,
      title: "Seguro e Confiável",
      description: "Seus dados financeiros protegidos com criptografia de ponta e backups automáticos."
    },
    {
      icon: BarChart3,
      title: "Gestão Empresarial Simplificada",
      description: "Controle suas contas PJ com fluxo de caixa dedicado e relatórios estratégicos."
    },
    {
      icon: Wallet,
      title: "Múltiplas Contas",
      description: "Gerencie contas pessoais e empresariais em um único lugar com limites flexíveis."
    },
    {
      icon: FileText,
      title: "Relatórios Profissionais",
      description: "Exporte relatórios em PDF e CSV para análises detalhadas e prestação de contas."
    }
  ];

  const futurePlanningBenefits = [
    {
      title: "Controle do que você gastou",
      description: "Dashboard que consolida todas as movimentações e mostra onde o seu dinheiro realmente ficou."
    },
    {
      title: "Planejamento do que vai gastar",
      description: "Cadastre despesas futuras, boletos e assinaturas e já veja o impacto no seu caixa."
    },
    {
      title: "Previsão do quanto vai sobrar",
      description: "O FinScope estima o saldo livre depois de pagar as contas para você tomar decisões com antecedência."
    },
    {
      title: "Lembretes inteligentes",
      description: "Receba avisos antes dos vencimentos para nunca mais esquecer um pagamento."
    },
    {
      title: "Relatórios automáticos",
      description: "PDFs que mostram gastos reais x previstos e projeções completas, prontos para compartilhar."
    },
  ];

  const plans = [
    {
      name: "Pro",
      price: "R$ 19,90",
      period: "/mês",
      description: "Ideal para controle pessoal completo",
      features: [
        "Até 3 contas financeiras",
        "Controle de gastos passados",
        "Planejamento básico de contas a pagar",
        "Previsão simples do saldo",
        "Alertas por e-mail",
        "Exportação PDF básico",
        "Suporte via e-mail"
      ],
      cta: "Assinar plano Pro",
      highlighted: false,
      badge: "10 dias de garantia"
    },
    {
      name: "Premium",
      price: "R$ 29,90",
      period: "/mês",
      description: "Solução completa para pessoa física e empresas",
      features: [
        "Contas ilimitadas PF + PJ",
        "Dashboard avançado com previsões",
        "Planejamento detalhado de gastos futuros",
        "Relatórios Premium com projeção de saldo",
        "Lembretes inteligentes e automações",
        "Categoria MEI dentro da conta PJ",
        "Economia recomendada e insights",
        "Acesso antecipado a recursos",
        "Backup automático"
      ],
      cta: "Assinar plano Premium",
      highlighted: true,
      badge: "Mais popular"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <FinScopeHeader />

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          <div className="space-y-6 text-center lg:text-left">
            <Badge variant="secondary" className="w-fit" data-testid="badge-hero">
              Planejamento financeiro completo
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold tracking-tight" data-testid="text-hero-title">
              Veja o que gastou, planeje o que vai gastar e saiba quanto vai sobrar
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl" data-testid="text-hero-subtitle">
              O FinScope reúne contas PF e PJ com controle do histórico, planejamento de despesas futuras e previsões automáticas
              para que você tome decisões com semanas de antecedência.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto" data-testid="button-cta-primary">
                  Começar agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#planos">
                <Button size="lg" variant="outline" className="w-full sm:w-auto" data-testid="button-cta-secondary">
                  Ver Planos
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground" data-testid="text-hero-note">
              Checkout seguro • 10 dias de garantia para pedir reembolso
            </p>
          </div>
          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl" />
              <Card className="relative bg-card/50 backdrop-blur border-2">
                <CardHeader>
                  <CardTitle className="font-poppins">Resumo Financeiro</CardTitle>
                  <CardDescription>Visão geral do mês</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-secondary/10 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Saldo Total</p>
                      <p className="text-2xl font-semibold text-secondary">R$ 12.450,00</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-secondary" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Receitas</p>
                      <p className="text-lg font-semibold">R$ 8.500</p>
                    </div>
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <p className="text-xs text-muted-foreground">Despesas</p>
                      <p className="text-lg font-semibold">R$ 4.320</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-poppins font-bold" data-testid="text-benefits-title">
              Tudo que você precisa para gerenciar suas finanças
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-benefits-subtitle">
              Ferramentas poderosas e intuitivas para ter controle total do seu dinheiro
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover-elevate" data-testid={`card-benefit-${index}`}>
                <CardHeader>
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="font-poppins">{benefit.title}</CardTitle>
                  <CardDescription>{benefit.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="planejamento" className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="space-y-5">
              <Badge variant="outline" className="w-fit">
                Planeje o seu futuro financeiro
              </Badge>
              <h2 className="text-3xl md:text-4xl font-poppins font-bold">
                Controle hoje e antecipe amanhã
              </h2>
              <p className="text-lg text-muted-foreground">
                O FinScope combina o histórico das suas finanças com previsões automáticas para você saber exatamente
                quanto vai precisar e quanto dinheiro vai sobrar em cada período.
              </p>
              <div className="space-y-3">
                {futurePlanningBenefits.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Card className="bg-card/70 backdrop-blur border-primary/20 shadow-xl">
              <CardHeader>
                <CardTitle className="font-poppins">Exemplo de previsão</CardTitle>
                <CardDescription>Saldo projetado após contas futuras</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">Saldo previsto</p>
                  <p className="text-2xl font-semibold text-primary">R$ 15.380,00</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">Gastos futuros</p>
                    <p className="text-lg font-semibold text-destructive">R$ 4.820,00</p>
                  </div>
                  <div className="rounded-xl border p-4">
                    <p className="text-xs text-muted-foreground">Dinheiro livre</p>
                    <p className="text-lg font-semibold text-emerald-600">R$ 6.560,00</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Valores ilustrativos com base nas contas a pagar e receitas previstas cadastradas.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-poppins font-bold" data-testid="text-pricing-title">
              Escolha o plano ideal para você
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
              Assine com 10 dias de garantia e tenha controle do que gastou, vai gastar e do quanto vai sobrar.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto justify-items-center">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative flex flex-col ${plan.highlighted ? 'border-primary border-2 shadow-lg' : ''}`}
                data-testid={`card-plan-${plan.name.toLowerCase()}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant={plan.highlighted ? "default" : "secondary"} data-testid={`badge-plan-${plan.name.toLowerCase()}`}>
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="font-poppins" data-testid={`text-plan-name-${plan.name.toLowerCase()}`}>
                    {plan.name}
                  </CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold font-poppins" data-testid={`text-plan-price-${plan.name.toLowerCase()}`}>
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                  <CardDescription data-testid={`text-plan-description-${plan.name.toLowerCase()}`}>
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start gap-2" data-testid={`text-plan-feature-${index}-${featureIndex}`}>
                        <Check className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations?.map((limitation, limIndex) => (
                      <li key={`lim-${limIndex}`} className="flex items-start gap-2 text-muted-foreground" data-testid={`text-plan-limitation-${index}-${limIndex}`}>
                        <span className="text-sm">• {limitation}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/signup" className="w-full">
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      data-testid={`button-select-plan-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <FinScopeFooter />

    </div>
  );
}
