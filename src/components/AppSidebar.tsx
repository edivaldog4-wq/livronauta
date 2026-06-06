import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard, Library, Users, RefreshCw, Tag, Settings, User as UserIcon, LogOut } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

interface NavItem { title: string; url: string; icon: any; staff?: boolean; adminOnly?: boolean }

const items: NavItem[] = [
  { title: "Catálogo", url: "/catalog", icon: Library },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, staff: true },
  { title: "Acervo", url: "/books", icon: BookOpen, staff: true },
  { title: "Empréstimos", url: "/loans", icon: RefreshCw, staff: true },
  { title: "Usuários", url: "/users", icon: Users, staff: true },
  { title: "Etiquetas", url: "/labels", icon: Tag, staff: true },
  { title: "Configurações", url: "/settings", icon: Settings, adminOnly: true },
  { title: "Meu Perfil", url: "/profile", icon: UserIcon },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isStaff, isAdmin, user, signOut, roles } = useAuth();

  const visible = items.filter((i) => {
    if (i.adminOnly) return isAdmin;
    if (i.staff) return isStaff;
    return true;
  });

  const roleLabel = roles.includes("admin") ? "Administrador" : roles.includes("bibliotecario") ? "Bibliotecário" : "Membro";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/catalog" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">Biblioteca</span>
            <span className="text-xs text-sidebar-foreground/60">Sistema de Gestão</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        {user ? (
          <div className="space-y-2 p-2 group-data-[collapsible=icon]:hidden">
            <div className="text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
            <div className="text-[10px] uppercase tracking-wide text-sidebar-foreground/50">{roleLabel}</div>
            <Button variant="secondary" size="sm" className="w-full" onClick={signOut}>
              <LogOut className="h-3 w-3 mr-1" /> Sair
            </Button>
          </div>
        ) : (
          <div className="p-2 group-data-[collapsible=icon]:hidden">
            <Button asChild size="sm" className="w-full">
              <Link to="/auth">Entrar</Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
