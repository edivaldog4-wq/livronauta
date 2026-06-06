import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Biblioteca" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [multa, setMulta] = useState("1.00");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*")).data ?? [],
  });

  useEffect(() => {
    const m = settings?.find((s: any) => s.key === "multa_por_dia");
    if (m) setMulta(String(m.value));
  }, [settings]);

  if (!isAdmin) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Apenas administradores podem acessar.</CardContent></Card></div>;

  const save = async () => {
    const v = parseFloat(multa);
    if (isNaN(v) || v < 0) return toast.error("Valor inválido");
    const { error } = await supabase.from("settings").upsert({ key: "multa_por_dia", value: v as any, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Parâmetros globais do sistema</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <Label>Multa por dia de atraso (R$)</Label>
            <Input type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} />
            <p className="text-xs text-muted-foreground">Aplicada por dia em devoluções após a data prevista.</p>
          </div>
          <Button onClick={save}>Salvar</Button>
        </CardContent>
      </Card>
    </div>
  );
}
