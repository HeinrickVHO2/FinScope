import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  PieChart, 
  Zap, 
  Shield, 
  BarChart3, 
  Wallet, 
  FileText,
  Check,
  ArrowRight
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
      title: "Gestão MEI Simplificada",
      description: "Controle separado para seu microempreendimento com fluxo de caixa e relatórios."
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

  const plans = [
    {
      name: "Free",
      price: "Grátis",
      description: "Para começar a organizar suas finanças",
      features: [
        "1 conta financeira",
        "Dashboard básico",
        "Transações ilimitadas",
        "Categorização manual"
      ],
      limitations: [
        "Sem relatórios",
        "Sem exportação",
        "Sem alertas automáticos"
      ],
      cta: "Começar Grátis",
      highlighted: false
    },
    {
      name: "Pro",
      price: "R$ 29,90",
      period: "/mês",
      description: "Ideal para controle pessoal completo",
      features: [
        "Até 3 contas financeiras",
        "Dashboard financeiro básico",
        "Fluxo de caixa mensal",
        "Categorização manual",
        "Alertas simples de pagamento",
        "Exportação CSV",
        "Suporte via e-mail"
      ],
      cta: "Iniciar Teste Grátis",
      highlighted: false,
      badge: "10 dias grátis"
    },
    {
      name: "Premium",
      price: "R$ 47,90",
      period: "/mês",
      description: "Solução completa para pessoa física e MEI",
      features: [
        "Contas ilimitadas",
        "Dashboard avançado",
        "Categorização automática inteligente",
        "Relatórios PDF profissionais",
        "Alertas avançados",
        "Gestão completa MEI",
        "Organização financeira total",
        "Acesso antecipado a recursos",
        "Backup automático"
      ],
      cta: "Iniciar Teste Premium",
      highlighted: true,
      badge: "Mais popular"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-poppins font-bold">FinScope</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#beneficios" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-benefits">
              Benefícios
            </a>
            <a href="#planos" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-pricing">
              Planos
            </a>
            <Link href="/login">
              <Button variant="ghost" data-testid="button-login">Entrar</Button>
            </Link>
            <Link href="/signup">
              <Button data-testid="button-signup-header">Criar Conta</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="secondary" className="w-fit" data-testid="badge-hero">
              Teste grátis por 10 dias
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold tracking-tight" data-testid="text-hero-title">
              Controle completo das suas finanças pessoais e do seu negócio em um só lugar
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl" data-testid="text-hero-subtitle">
              Dashboards inteligentes, categorização automática e gestão MEI simplificada. 
              Tudo que você precisa para organizar sua vida financeira.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto" data-testid="button-cta-primary">
                  Iniciar Teste Grátis
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
              Sem cartão de crédito necessário • Cancele quando quiser
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
        <div className="container">
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

      {/* Pricing Section */}
      <section id="planos" className="py-20">
        <div className="container">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-poppins font-bold" data-testid="text-pricing-title">
              Escolha o plano ideal para você
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-pricing-subtitle">
              Comece com 10 dias grátis. Sem compromisso, cancele quando quiser.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="font-poppins font-bold">FinScope</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Controle financeiro inteligente para pessoas e microempresas.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Produto</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Recursos</a></li>
                <li><a href="#planos" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Termos</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; 2025 FinScope. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
