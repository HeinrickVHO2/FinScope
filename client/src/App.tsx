import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { AuthProvider, useRequireAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import AccountsPage from "@/pages/accounts";
import TransactionsPage from "@/pages/transactions";
import InvestmentsPage from "@/pages/investments";
import MEIPage from "@/pages/mei";
import SettingsPage from "@/pages/settings";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import SobrePage from "@/pages/sobre";
import FAQPage from "@/pages/faq";
import PrivacidadePage from "@/pages/privacidade";
import TermosPage from "@/pages/termos";
import ContatoPage from "@/pages/contato";
import BlogPage from "@/pages/blog";
import RecursosPage from "@/pages/recursos";
import BillingSettingsPage from "@/pages/settings-billing";
import OnboardingSuccessPage from "@/pages/onboarding-success";
import OnboardingErrorPage from "@/pages/onboarding-error";




function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const trialDaysLeft = user.trialEnd
    ? Math.ceil((new Date(user.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <DashboardHeader
            userName={user.fullName}
            userPlan={user.plan}
            trialDaysLeft={trialDaysLeft}
          />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/sobre" component={SobrePage} />
      <Route path="/faq" component={FAQPage} />
      <Route path="/privacidade" component={PrivacidadePage} />
      <Route path="/termos" component={TermosPage} />
      <Route path="/contato" component={ContatoPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/recursos" component={RecursosPage} />
      <Route path="/onboarding/success" component={OnboardingSuccessPage} />
      <Route path="/onboarding/error" component={OnboardingErrorPage} />


      {/* 🔥 ADICIONE ESTAS DUAS LINHAS ABAIXO */}
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* 🔥 Rota corrigida para aceitar query strings */}
      <Route path="/reset-password" nest>
        {() => <ResetPasswordPage />}
      </Route>


      {/* 🔥 ------------------------------ */}

      {/* Dashboard routes with layout */}
      <Route path="/dashboard">
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      </Route>
      <Route path="/accounts">
        <DashboardLayout>
          <AccountsPage />
        </DashboardLayout>
      </Route>
      <Route path="/transactions">
        <DashboardLayout>
          <TransactionsPage />
        </DashboardLayout>
      </Route>
      <Route path="/investments">
        <DashboardLayout>
          <InvestmentsPage />
        </DashboardLayout>
      </Route>
      <Route path="/mei">
        <DashboardLayout>
          <MEIPage />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <SettingsPage />
        </DashboardLayout>
      </Route>
      <Route path="/settings/billing">
        <DashboardLayout>
          <BillingSettingsPage />
        </DashboardLayout>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
