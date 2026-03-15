import { useState, type ComponentType } from "react";
import { Home, ArrowLeftRight, Settings, PiggyBank, Building2, Lock, CalendarClock, Sparkles, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import UpgradeModal from "@/components/UpgradeModal";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const baseMenuItems = [
  { title: "Início", url: "/dashboard", icon: Home },
  { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
  { title: "Investimentos", url: "/investments", icon: PiggyBank },
  { title: "Configurações", url: "/settings", icon: Settings },
];

type MenuItem = {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  requiresPremium?: boolean;
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const isPremium = user?.plan === "premium";
  const menuItems: MenuItem[] = [
    baseMenuItems[0],
    { title: "Gestão PJ e MEI", url: "/mei", icon: Building2, requiresPremium: true },
    { title: "Contas a Pagar", url: "/future-expenses", icon: CalendarClock, requiresPremium: false },
    { title: "WhatsApp", url: "/whatsapp-agent", icon: MessageCircle, requiresPremium: false },
    { title: "Assistente com IA", url: "/ai", icon: Sparkles },
    ...baseMenuItems.slice(1),
  ];

  return (
    <>
    <Sidebar data-testid="sidebar">
      <SidebarHeader className="p-4">
        <a href="/dashboard" className="flex items-center gap-2">
          
          {/* Logo no sidebar */}
          <img
            src="/logo.png"
            alt="FinScope"
            className="h-19 max-h-20 w-auto"
            draggable="false"
          />

        </a>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isLocked = item.requiresPremium && !isPremium;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={!isLocked && location === item.url}
                      data-testid={`sidebar-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      className={isLocked ? "opacity-60" : undefined}
                    >
                      {isLocked ? (
                        <button
                          type="button"
                          className="flex w-full items-center gap-2"
                          onClick={() => setIsUpgradeModalOpen(true)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <a href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </a>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    <UpgradeModal open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen} featureName="Gestão PJ e MEI" />
    </>
  );
}



