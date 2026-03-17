import { useEffect, useMemo, useState } from "react";
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
import { Bell, CircleHelp, Clock3, LogOut, Mail, Megaphone, Sparkles, TriangleAlert, User, X } from "lucide-react";
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
  bucket: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  route?: string;
  ctaLabel?: string;
};

type NotificationResponse = {
  unreadCount: number;
  notifications: NotificationItem[];
  summary: Record<string, number>;
  groups: Record<string, NotificationItem[]>;
};

export function DashboardHeader({ 
  userName = "Usuário", 
  userPlan = "pro",
  trialDaysLeft 
}: DashboardHeaderProps) {
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
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

  const storageKey = `finscope:dismissed-notifications:${userName}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      setDismissedNotifications(stored ? JSON.parse(stored) : []);
    } catch {
      setDismissedNotifications([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(dismissedNotifications));
  }, [dismissedNotifications, storageKey]);

  const getPlanBadge = () => {
    const badges = {
      pro: { label: "Pro", variant: "default" as const },
      premium: { label: "Premium", variant: "default" as const },
    };
    return badges[userPlan as keyof typeof badges] || badges.pro;
  };

  const planBadge = getPlanBadge();
  const notifications = notificationsQuery.data?.notifications || [];
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => !dismissedNotifications.includes(notification.id)),
    [dismissedNotifications, notifications],
  );
  const groupedNotifications = useMemo(
    () => ({
      attention: visibleNotifications.filter((notification) => ["overdue", "today", "week"].includes(notification.bucket)),
      updates: visibleNotifications.filter((notification) => notification.kind === "global_update"),
      promotions: visibleNotifications.filter((notification) => notification.kind === "global_promotion"),
      general: visibleNotifications.filter((notification) => notification.kind === "global_alert" || notification.bucket === "general"),
    }),
    [visibleNotifications],
  );
  const unreadCount = visibleNotifications.length;

  const dismissNotification = (notificationId: string) => {
    setDismissedNotifications((current) => (
      current.includes(notificationId) ? current : [...current, notificationId]
    ));
  };

  const clearVisibleNotifications = () => {
    setDismissedNotifications((current) => {
      const next = new Set(current);
      visibleNotifications.forEach((notification) => next.add(notification.id));
      return Array.from(next);
    });
  };

  const openSupportEmail = () => {
    if (typeof window === "undefined") return;
    window.location.href = "mailto:contato@finscope.com.br";
  };

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
            <DropdownMenuLabel className="flex items-center justify-between gap-3">
              <span>Notificacoes</span>
              {visibleNotifications.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    clearVisibleNotifications();
                  }}
                >
                  Limpar
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleNotifications.length ? (
              <>
                {([
                  { key: "attention", label: "Atencao", icon: <TriangleAlert className="h-3.5 w-3.5 text-rose-500" /> },
                  { key: "updates", label: "Atualizacoes", icon: <Megaphone className="h-3.5 w-3.5 text-sky-500" /> },
                  { key: "promotions", label: "Promocoes", icon: <Sparkles className="h-3.5 w-3.5 text-amber-500" /> },
                  { key: "general", label: "Geral", icon: <Bell className="h-3.5 w-3.5 text-muted-foreground" /> },
                ] as const)
                  .filter((group) => groupedNotifications[group.key].length > 0)
                  .map((group) => (
                    <div key={group.key}>
                      <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {group.icon}
                        {group.label}
                      </div>
                      {groupedNotifications[group.key].slice(0, 4).map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="items-start gap-3 whitespace-normal"
                          onClick={() => notification.route && setLocation(notification.route)}
                        >
                          {notification.severity === "high" ? (
                            <TriangleAlert className="mt-0.5 h-4 w-4 text-rose-500" />
                          ) : notification.kind === "global_promotion" ? (
                            <Sparkles className="mt-0.5 h-4 w-4 text-amber-500" />
                          ) : notification.kind === "global_update" ? (
                            <Megaphone className="mt-0.5 h-4 w-4 text-sky-500" />
                          ) : notification.bucket === "week" ? (
                            <Clock3 className="mt-0.5 h-4 w-4 text-sky-500" />
                          ) : (
                            <Clock3 className="mt-0.5 h-4 w-4 text-amber-500" />
                          )}
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">{notification.title}</p>
                            <p className="text-xs text-muted-foreground">{notification.message}</p>
                            {notification.ctaLabel && (
                              <p className="text-[11px] font-medium text-primary">{notification.ctaLabel}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-7 w-7 shrink-0"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              dismissNotification(notification.id);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
              </>
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground">
                Sem alertas no momento.
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-support-menu">
              <CircleHelp className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Ajuda e suporte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/faq")} data-testid="menu-item-faq">
              <CircleHelp className="mr-2 h-4 w-4" />
              Central de ajuda
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLocation("/contato")} data-testid="menu-item-contact">
              <User className="mr-2 h-4 w-4" />
              Falar com o suporte
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openSupportEmail} data-testid="menu-item-email-support">
              <Mail className="mr-2 h-4 w-4" />
              contato@finscope.com.br
            </DropdownMenuItem>
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
