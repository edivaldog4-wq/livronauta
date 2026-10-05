import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export function AppLayout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 md:h-14 flex items-center gap-3 border-b border-border bg-card px-3 md:px-4 no-print">
            <SidebarTrigger
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
              className="h-11 min-w-24 w-auto gap-2 bg-primary px-3 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground after:content-['Menu'] md:h-8 md:min-w-8 md:w-8 md:bg-transparent md:px-0 md:text-foreground md:shadow-none md:hover:bg-accent md:hover:text-accent-foreground md:after:content-none [&_svg]:size-5 md:[&_svg]:size-4"
            />
            {title && <h1 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h1>}
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
