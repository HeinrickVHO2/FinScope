import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Clock3, LogOut, TriangleAlert, User } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface DashboardHeaderProps {
  userName?: string;
  userPlan?: string;
  trialDaysLeft?: number;
}

type NotificationItem = {
  id: string;
  kind: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  route?: string;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: NotificationItem[];
};

export function DashboardHeader({ 
  userName = "Usuário", 
  userPlan = "pro",
  trialDaysLeft 
}: DashboardHeaderProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const notificationsQuery = useQuery<NotificationResponse>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications");
      return response.json();
    },
    staleTime: 60_000,
  });

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
  const notifications = notificationsQuery.data?.notifications || [];
  const unreadCount = notificationsQuery.data?.unreadCount || 0;

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
            <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificacoes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length ? (
              notifications.slice(0, 6).map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="items-start gap-3 whitespace-normal"
                  onClick={() => notification.route && setLocation(notification.route)}
                >
                  {notification.severity === "high" ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 text-rose-500" />
                  ) : (
                    <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                  )}
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Sem alertas no momento.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
