import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface DashboardHeaderProps {
  userName?: string;
  userPlan?: string;
}

export function DashboardHeader({ 
  userName = "Usuário", 
  userPlan = "pro",
  trialDaysLeft 
}: DashboardHeaderProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const getPlanBadge = () => {
    const badges = {
      pro: { label: "Pro", variant: "default" as const },
      premium: { label: "Premium", variant: "default" as const },
    };
    return badges[userPlan as keyof typeof badges] || badges.pro;
  };

  const planBadge = getPlanBadge();

  return (
    <header className="flex items-center justify-between gap-4 border-b p-4 bg-background">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        {trialDaysLeft !== undefined && trialDaysLeft > 0 && (
          <Badge variant="secondary" className="hidden sm:flex" data-testid="badge-trial">
            {trialDaysLeft} dias restantes na garantia
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={planBadge.variant} data-testid="badge-plan">
          {planBadge.label}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
              <Avatar>
                <AvatarFallback>{userName.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium" data-testid="text-user-name">{userName}</p>
                <p className="text-xs text-muted-foreground">Plano {planBadge.label}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/settings")} data-testid="menu-item-settings">
              <User className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} data-testid="menu-item-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
