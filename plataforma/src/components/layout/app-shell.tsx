import { useState, type ReactNode } from "react";
import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  Calculator,
  ClipboardCheck,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Beef,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/demo-mode";
import { logoutDemo } from "@/lib/demo-store";
import { ROLE_LABEL, type AppRole } from "@/lib/pedidos";
import type { Me } from "@/lib/queries";

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: ReactNode; exact?: boolean };
type NavGroup = { title?: string; items: NavItem[] };

function navFor(role: AppRole): NavGroup[] {
  const guia: NavItem = { to: "/guia", label: "Guía rápida", icon: <BookOpen /> };
  switch (role) {
    case "general":
      return [
        {
          title: "Administración",
          items: [
            { to: "/general", label: "Panel", icon: <LayoutDashboard />, exact: true },
            { to: "/general/pedidos", label: "Todos los pedidos", icon: <ListOrdered /> },
            { to: "/general/estadisticas", label: "Estadísticas", icon: <BarChart3 /> },
            { to: "/general/usuarios", label: "Usuarios", icon: <Users /> },
          ],
        },
        {
          title: "Colas por rol",
          items: [
            { to: "/comercial", label: "Comercial", icon: <ClipboardCheck /> },
            { to: "/contable", label: "Contable", icon: <Calculator /> },
            { to: "/carnicero", label: "Carnicero", icon: <Beef /> },
          ],
        },
        { items: [guia] },
      ];
    case "comercial":
      return [{ items: [{ to: "/comercial", label: "Mis colas", icon: <ClipboardCheck /> }, guia] }];
    case "contable":
      return [{ items: [{ to: "/contable", label: "Mis colas", icon: <Calculator /> }, guia] }];
    case "carnicero":
      return [{ items: [{ to: "/carnicero", label: "Mis colas", icon: <Beef /> }, guia] }];
  }
}

function SidebarContent({ me, onNavigate }: { me: Me; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const groups = navFor(me.role!);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    if (isDemoMode()) logoutDemo();
    else await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
        <div className="grid size-8 place-items-center rounded-sm bg-sidebar-primary font-mono text-sm font-bold text-sidebar-primary-foreground">
          P
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">Porcicola Ops</p>
          <p className="text-[11px] text-sidebar-muted">Operaciones carnicería</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Navegación principal">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title && <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    activeOptions={{ exact: item.exact ?? false }}
                    className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:shadow-[inset_2px_0_0_var(--sidebar-primary)] [&_svg]:size-4 [&_svg]:text-sidebar-muted data-[status=active]:[&_svg]:text-sidebar-primary"
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{me.fullName}</p>
        <p className="truncate text-xs text-sidebar-muted">{me.email}</p>
        <p className="mt-1.5 inline-block rounded-sm border border-sidebar-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-sidebar-primary">
          {ROLE_LABEL[me.role!]}
        </p>
        <Button variant="sidebar" size="sm" className="mt-2 w-full" onClick={signOut}>
          <LogOut /> Cerrar sesión
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ me, children }: { me: Me; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 md:block">
        <SidebarContent me={me} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground md:hidden">
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-sm bg-sidebar-primary font-mono text-xs font-bold text-sidebar-primary-foreground">P</div>
            <span className="text-sm font-semibold text-sidebar-accent-foreground">Porcicola Ops</span>
          </div>
          <Button variant="sidebar" size="icon" aria-label="Abrir menú" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 border-sidebar-border p-0">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <SidebarContent me={me} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
