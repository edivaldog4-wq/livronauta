import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useLibraryUsage, useMyLibraries, switchLibrary } from "@/lib/library";
import { useServerFn } from "@tanstack/react-start";
import { createAsaasSubscription, cancelAsaasSubscription } from "@/lib/billing.functions";

function UpgradeBox({ pending }: { pending: boolean }) {
  const createFn = useServerFn(createAsaasSubscription);
  const { user } = useAuth();
  const [f, setF] = useState({ nome: "", cpfCnpj: "", email: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF((current) => ({
      ...current,
      nome: current.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || "",
      email: current.email || user?.email || "",
    }));
  }, [user]);
  const go = async () => {
    setBusy(true);
    try {
      const { url } = await createFn({ data: { ...f, cpfCnpj: f.cpfCnpj.replace(/\D/g, "") } });
      window.open(url, "_blank", "noopener");
      toast.success("Página de pagamento aberta. O plano é ativado assim que o pagamento for confirmado.");
    } catch (e: any) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div className="space-y-3 rounded-md border-2 border-primary p-4">
      <div className="font-semibold">Plano Pro — livros ilimitados por R$ 14,99/mês</div>
      <p className="text-sm text-muted-foreground">Pix, boleto ou cartão. Cancele quando quiser.</p>
      {pending && <p className="text-sm font-medium">Há um pagamento aguardando confirmação.</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Nome completo" maxLength={100} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <Input placeholder="CPF ou CNPJ" maxLength={18} value={f.cpfCnpj} onChange={(e) => setF({ ...f, cpfCnpj: e.target.value })} />
        <Input placeholder="E-mail" type="email" maxLength={255} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </div>
      <Button onClick={go} disabled={busy} className="font-semibold">{busy ? "Gerando cobrança..." : pending ? "Abrir pagamento" : "Fazer upgrade"}</Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plano e bibliotecas — Livronauta" },
      { name: "description", content: "Gerencie o plano, convites e bibliotecas no Livronauta." },
      { property: "og:title", content: "Plano e bibliotecas — Livronauta" },
      { property: "og:description", content: "Gerencie o plano, convites e bibliotecas no Livronauta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanPage,
});

const planLabel: Record<string, string> = { free: "Gratuito", pro: "Pro", unlimited: "Ilimitado" };

function PlanPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: usage } = useLibraryUsage();
  const { data: mine } = useMyLibraries();
  const [code, setCode] = useState("");
  const [newName, setNewName] = useState("");

  const join = async () => {
    if (!code.trim()) return;
    const { error } = await supabase.rpc("join_library" as any, { _code: code.trim() });
    if (error) return toast.error(error.message);
    toast.success("Você entrou na biblioteca");
    window.location.href = "/catalog";
  };
  const create = async () => {
    const { error } = await supabase.rpc("create_library" as any, { _nome: newName.trim() });
    if (error) return toast.error(error.message);
    toast.success("Biblioteca criada");
    window.location.href = "/dashboard";
  };
  const cancelFn = useServerFn(cancelAsaasSubscription);
  const cancel = async () => {
    if (!confirm("Cancelar a assinatura Pro? A biblioteca volta ao plano gratuito (nada é apagado).")) return;
    try { await cancelFn(); toast.success("Assinatura cancelada"); qc.invalidateQueries({ queryKey: ["library-usage"] }); }
    catch (e: any) { toast.error(e.message); }
  };
  const regen = async () => {
    const { error } = await supabase.rpc("regenerate_invite_code" as any);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["library-usage"] });
  };

  const isFree = usage?.plan === "free";
  const pct = usage ? Math.min(100, (usage.books / usage.limit) * 100) : 0;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Plano e bibliotecas</h1>
        <p className="text-muted-foreground text-sm">{usage?.nome}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Plano atual <Badge>{planLabel[usage?.plan ?? "free"]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isFree ? (
            <>
              <div className="text-sm">{usage?.books ?? 0} de {usage?.limit ?? 50} livros usados</div>
              <Progress value={pct} />
              {isAdmin && <UpgradeBox pending={usage?.status === "pending"} />}
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <div>{usage?.books ?? 0} livros · sem limite</div>
              {usage?.plan === "pro" && (
                <>
                  <div>
                    Status: <b>{usage.status === "active" ? "Ativa" : usage.status === "overdue" ? "Pagamento atrasado (7 dias de carência)" : usage.status}</b>
                    {usage.period_end && <> · próxima cobrança {new Date(usage.period_end).toLocaleDateString("pt-BR")}</>}
                  </div>
                  {isAdmin && <Button variant="outline" size="sm" onClick={cancel}>Cancelar assinatura</Button>}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && usage?.invite_code && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convidar pessoas</CardTitle>
            <CardDescription>Envie este código para quem deve entrar na sua biblioteca como membro.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-muted px-3 py-2 text-lg font-bold tracking-widest">{usage.invite_code}</code>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(usage.invite_code!); toast.success("Código copiado"); }}>Copiar</Button>
            <Button variant="ghost" onClick={regen}>Gerar novo código</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Minhas bibliotecas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {mine?.libraries.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded border p-2">
              <span className="text-sm">{l.nome} <span className="text-muted-foreground">· {planLabel[l.plan] ?? l.plan}</span></span>
              {mine.active === l.id ? <Badge variant="secondary">Atual</Badge> : (
                <Button size="sm" variant="outline" onClick={() => switchLibrary(l.id).catch((e) => toast.error(e.message))}>Abrir</Button>
              )}
            </div>
          ))}
          <div className="grid gap-3 pt-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Entrar com código de convite</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex.: A1B2C3D4" />
                <Button onClick={join}>Entrar</Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Criar nova biblioteca</Label>
              <div className="flex gap-2">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" />
                <Button onClick={create}>Criar</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
