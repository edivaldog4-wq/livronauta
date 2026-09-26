import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";

export const CONTACT_EMAIL = "atendimento@triregnum.com.br";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark compact className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight">Livronauta</span>
        </Link>
        <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="/#vantagens" className="hover:text-foreground">Vantagens</a>
          <a href="/#planos" className="hover:text-foreground">Planos</a>
          <a href="/#contato" className="hover:text-foreground">Contato</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/auth">Criar conta grátis</Link></Button>
          <Button asChild className="px-5 font-semibold shadow-md"><Link to="/auth">Entrar</Link></Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary text-secondary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <BrandMark compact />
          <span className="font-semibold">Livronauta</span>
          <span className="opacity-60">© {new Date().getFullYear()}</span>
        </div>
        <div className="flex flex-wrap gap-4 opacity-80">
          <Link to="/termos" className="hover:underline">Termos de uso</Link>
          <Link to="/privacidade" className="hover:underline">Política de privacidade</Link>
          <a href="/#contato" className="hover:underline">Contato</a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline">{CONTACT_EMAIL}</a>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,var(--accent),var(--background)_42%)]">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
