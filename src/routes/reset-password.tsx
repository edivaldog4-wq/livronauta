import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/BrandMark";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Redefinir senha — Livronauta" },
    { name: "description", content: "Escolha uma nova senha para sua conta Livronauta." },
    { property: "og:title", content: "Redefinir senha — Livronauta" },
    { property: "og:description", content: "Escolha uma nova senha para sua conta Livronauta." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) { setReady(true); setChecking(false); }
    });
    void supabase.auth.getUser().then(({ data }) => { setReady(Boolean(data.user)); setChecking(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };
  return <main className="flex min-h-screen items-center justify-center bg-background px-4"><div className="w-full max-w-md space-y-5"><BrandMark className="size-14" /><h1 className="text-2xl font-bold">Redefinir senha</h1>
    {checking ? <p>Verificando seu link…</p> : done ? <><p>Senha atualizada com sucesso.</p><Button asChild><Link to="/auth">Entrar</Link></Button></> : !ready ? <><p className="text-muted-foreground">Este link expirou ou é inválido. Solicite um novo e-mail de recuperação.</p><Button asChild variant="outline"><Link to="/auth">Voltar ao login</Link></Button></> : <form onSubmit={submit} className="space-y-4"><div className="space-y-2"><Label htmlFor="new-password">Nova senha</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirmar senha</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={busy} className="w-full">{busy ? "Salvando…" : "Salvar nova senha"}</Button></form>}
  </div></main>;
}