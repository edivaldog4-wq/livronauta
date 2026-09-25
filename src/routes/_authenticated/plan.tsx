import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
              <div className="text-sm">{usage?.books ?? 0} de {usage?.limit ?? 150} livros usados</div>
              <Progress value={pct} />
              <div className="rounded-md border p-3 space-y-2">
                <div className="font-semibold">Plano Pro — livros ilimitados</div>
                <p className="text-sm text-muted-foreground">Pagamento por Pix, boleto ou cartão. Em breve.</p>
                <Button disabled>Fazer upgrade</Button>
              </div>
            </>
          ) : (
            <div className="text-sm">{usage?.books ?? 0} livros · sem limite</div>
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
