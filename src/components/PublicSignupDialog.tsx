import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type SignupPlan = "free" | "pro";

export function PublicSignupDialog({
  open,
  plan,
  onOpenChange,
}: {
  open: boolean;
  plan: SignupPlan;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ nome: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const isPro = plan === "pro";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres.");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth${isPro ? "?plan=pro" : ""}`,
        data: { nome: form.nome, onboarding_plan: plan },
      },
    });
    setBusy(false);
    if (error) return toast.error(`Não foi possível criar a conta: ${error.message}`);

    if (data.session) {
      toast.success("Conta e biblioteca criadas!");
      navigate({ to: isPro ? "/plan" : "/dashboard" });
      return;
    }

    toast.success(
      isPro
        ? "Confira seu e-mail. Depois da confirmação, você continuará para o pagamento."
        : "Confira seu e-mail para confirmar e acessar sua nova biblioteca.",
      { duration: 7000 },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {isPro ? <Crown /> : <BookOpen />}
          </div>
          <DialogTitle>{isPro ? "Começar com o plano Pro" : "Criar minha biblioteca grátis"}</DialogTitle>
          <DialogDescription>
            {isPro
              ? "Crie sua biblioteca e prossiga para o pagamento seguro de R$ 14,99/mês."
              : "Até 50 livros, sem cartão e sem pagamento."}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted p-3 text-sm">
          <div className="flex items-center gap-2 font-medium"><Check className="text-primary" /> Biblioteca própria pronta para usar</div>
          <div className="mt-1 flex items-center gap-2 font-medium"><Check className="text-primary" /> Exemplos para conhecer o sistema</div>
          {isPro && <div className="mt-1 flex items-center gap-2 font-medium"><Check className="text-primary" /> Livros ilimitados</div>}
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="signup-name">Nome completo</Label>
            <Input id="signup-name" autoComplete="name" required maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-email">E-mail</Label>
            <Input id="signup-email" type="email" autoComplete="email" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-password">Senha</Label>
            <Input id="signup-password" type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <Button type="submit" className="h-11 w-full font-semibold" disabled={busy}>
            {busy ? "Criando sua biblioteca..." : isPro ? "Criar conta e continuar" : "Começar grátis"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ao continuar, você concorda com os <Link to="/termos" className="underline">Termos de uso</Link> e a <Link to="/privacidade" className="underline">Política de privacidade</Link>.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}