import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import DashboardPage from "@/pages/dashboard";
import AccountsPage from "@/pages/accounts";
import TransactionsPage from "@/pages/transactions";
import MEIPage from "@/pages/mei";
import SettingsPage from "@/pages/settings";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Mock user data - will be replaced with real auth in Task 3
  const userName = "João Silva";
  const userPlan = "free";
  const trialDaysLeft = 8;

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
            userName={userName}
            userPlan={userPlan}
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
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
