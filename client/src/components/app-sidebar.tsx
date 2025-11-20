import { Home, ArrowLeftRight, Settings, PiggyBank, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
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
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Transações", url: "/transactions", icon: ArrowLeftRight },
  { title: "Investimentos", url: "/investments", icon: PiggyBank },
  { title: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const menuItems = user?.plan === "premium"
    ? [...baseMenuItems.slice(0, 1), { title: "Gestão PJ/MEI", url: "/mei", icon: Building2 }, ...baseMenuItems.slice(1)]
    : baseMenuItems;

  return (
    <Sidebar data-testid="sidebar">
      <SidebarHeader className="p-4">
        <a href="/dashboard" className="flex items-center gap-2">
          
          {/* 🔵 SUA LOGO NO SIDEBAR */}
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`sidebar-link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
