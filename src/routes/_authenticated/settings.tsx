import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BackupSection } from "@/components/BackupSection";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — Biblioteca" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [multa, setMulta] = useState("1.00");
  const [libName, setLibName] = useState("");
  const [newShelf, setNewShelf] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*")).data ?? [],
  });

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
  });

  useEffect(() => {
    const m = settings?.find((s: any) => s.key === "multa_por_dia");
    if (m) setMulta(String(m.value));
    const l = settings?.find((s: any) => s.key === "library_name");
    if (l) setLibName(typeof l.value === "string" ? l.value : String(l.value));
  }, [settings]);

  if (!isAdmin) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Apenas administradores podem acessar.</CardContent></Card></div>;

  const saveMulta = async () => {
    const v = parseFloat(multa);
    if (isNaN(v) || v < 0) return toast.error("Valor inválido");
    const { error } = await supabase.from("settings").upsert({ key: "multa_por_dia", value: v as any, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Multa atualizada");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const saveLibName = async () => {
    if (!libName.trim()) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("settings").upsert({ key: "library_name", value: libName.trim() as any, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Nome da biblioteca atualizado");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["library-name"] });
  };

  const addShelf = async () => {
    if (!newShelf.trim()) return;
    const { error } = await supabase.from("shelves").insert({ nome: newShelf.trim() });
    if (error) return toast.error(error.message);
    setNewShelf("");
    qc.invalidateQueries({ queryKey: ["shelves"] });
  };

  const updateShelf = async (id: string, nome: string) => {
    if (!nome.trim()) return;
    const { error } = await supabase.from("shelves").update({ nome: nome.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estante atualizada");
    qc.invalidateQueries({ queryKey: ["shelves"] });
  };

  const removeShelf = async (id: string) => {
    if (!confirm("Excluir esta estante?")) return;
    const { error } = await supabase.from("shelves").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["shelves"] });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Parâmetros globais do sistema</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Nome da biblioteca</Label>
            <div className="flex gap-2">
              <Input value={libName} onChange={(e) => setLibName(e.target.value)} />
              <Button onClick={saveLibName}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Aparece no menu, dashboard e comprovantes.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Multas</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Multa por dia de atraso (R$)</Label>
            <div className="flex gap-2">
              <Input type="number" step="0.01" min="0" value={multa} onChange={(e) => setMulta(e.target.value)} />
              <Button onClick={saveMulta}>Salvar</Button>
            </div>
            <p className="text-xs text-muted-foreground">Aplicada por dia em devoluções após a data prevista.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Estantes</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Nova estante (ex: A1, Ficção)" value={newShelf} onChange={(e) => setNewShelf(e.target.value)} />
            <Button onClick={addShelf}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shelves.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Nenhuma estante cadastrada</TableCell></TableRow>
                ) : shelves.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Input className="h-8" defaultValue={s.nome} onBlur={(e) => e.target.value !== s.nome && updateShelf(s.id, e.target.value)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => removeShelf(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <BackupSection />
    </div>
  );
}
