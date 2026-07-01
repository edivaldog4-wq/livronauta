import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Download, Upload, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadText } from "@/lib/libib-csv";

const AREAS: { key: string; label: string; table: string }[] = [
  { key: "books", label: "Acervo (livros)", table: "books" },
  { key: "categories", label: "Categorias", table: "categories" },
  { key: "shelves", label: "Estantes", table: "shelves" },
  { key: "profiles", label: "Usuários (perfis)", table: "profiles" },
  { key: "user_roles", label: "Papéis (admin/membro)", table: "user_roles" },
  { key: "loans", label: "Histórico de empréstimos", table: "loans" },
  { key: "loan_requests", label: "Solicitações de empréstimo", table: "loan_requests" },
  { key: "reservations", label: "Reservas", table: "reservations" },
  { key: "settings", label: "Configurações", table: "settings" },
];

export function BackupSection() {
  const [sel, setSel] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(AREAS.map((a) => [a.key, true])),
  );
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleAll = (v: boolean) => setSel(Object.fromEntries(AREAS.map((a) => [a.key, v])));

  const doExport = async () => {
    setBusy(true);
    try {
      const out: Record<string, any[]> = {};
      for (const a of AREAS) {
        if (!sel[a.key]) continue;
        const { data, error } = await supabase.from(a.table as any).select("*");
        if (error) throw new Error(`${a.label}: ${error.message}`);
        out[a.table] = data ?? [];
      }
      const payload = {
        _meta: { exportedAt: new Date().toISOString(), version: 1, areas: Object.keys(out) },
        data: out,
      };
      downloadText(
        `backup_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      );
      toast.success(`Backup exportado (${Object.keys(out).length} áreas)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!confirm("Restaurar dados deste backup? Registros existentes com o mesmo ID serão sobrescritos.")) return;
    setBusy(true);
    try {
      const json = JSON.parse(await f.text());
      const data = json.data ?? {};
      let total = 0;
      for (const a of AREAS) {
        if (!sel[a.key]) continue;
        const rows = data[a.table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const { error } = await supabase.from(a.table as any).upsert(rows, { onConflict: "id" });
        if (error) {
          toast.error(`${a.label}: ${error.message}`);
        } else {
          total += rows.length;
        }
      }
      toast.success(`Restauração concluída: ${total} registros`);
    } catch (e: any) {
      toast.error("Falha no arquivo: " + e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Backup e Restauração</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>Selecionar todas</Button>
          <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Limpar</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AREAS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={sel[a.key]} onCheckedChange={(v) => setSel({ ...sel, [a.key]: !!v })} />
              {a.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={doExport} disabled={busy}><Download className="h-4 w-4 mr-2" />Exportar backup (.json)</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4 mr-2" />Restaurar backup (.json)
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
        </div>
        <p className="text-xs text-muted-foreground">
          A restauração usa <code>upsert</code> por ID — registros existentes com o mesmo ID são sobrescritos; os demais são adicionados.
          Marque apenas as áreas que deseja exportar ou restaurar.
        </p>
      </CardContent>
    </Card>
  );
}

// Delete safe order: children before parents
const DELETION_AREAS: { key: string; label: string; table: string }[] = [
  { key: "loans", label: "Histórico de empréstimos", table: "loans" },
  { key: "loan_requests", label: "Solicitações de empréstimo", table: "loan_requests" },
  { key: "reservations", label: "Reservas", table: "reservations" },
  { key: "labels", label: "Etiquetas geradas", table: "labels" },
  { key: "books", label: "Acervo (livros)", table: "books" },
  { key: "categories", label: "Categorias", table: "categories" },
  { key: "shelves", label: "Estantes", table: "shelves" },
  { key: "settings", label: "Configurações", table: "settings" },
];

export function DataDeletionSection() {
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const toggleAll = (v: boolean) => setSel(Object.fromEntries(DELETION_AREAS.map((a) => [a.key, v])));
  const chosen = DELETION_AREAS.filter((a) => sel[a.key]);

  const doDelete = async () => {
    if (chosen.length === 0) return toast.error("Selecione ao menos uma área");
    if (confirmText.trim().toUpperCase() !== "EXCLUIR") {
      return toast.error('Digite "EXCLUIR" para confirmar');
    }
    setBusy(true);
    try {
      let total = 0;
      for (const a of chosen) {
        // Delete in given order (children first). Use neq on a boolean-ish predicate to match all rows.
        const { error, count } = await supabase
          .from(a.table as any)
          .delete({ count: "exact" })
          .not("id", "is", null);
        if (error) {
          toast.error(`${a.label}: ${error.message}`);
        } else {
          total += count ?? 0;
        }
      }
      toast.success(`Exclusão concluída: ${total} registro(s) removido(s)`);
      setSel({});
      setConfirmText("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Exclusão de dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Remove permanentemente os registros das áreas escolhidas. Usuários e papéis <strong>não</strong> podem ser excluídos por aqui.
          Faça um backup antes. As áreas são excluídas na ordem correta (dependências primeiro).
        </p>
        <div className="flex items-center gap-2 text-xs">
          <Button size="sm" variant="ghost" onClick={() => toggleAll(true)}>Selecionar todas</Button>
          <Button size="sm" variant="ghost" onClick={() => toggleAll(false)}>Limpar</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DELETION_AREAS.map((a) => (
            <label key={a.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!sel[a.key]} onCheckedChange={(v) => setSel({ ...sel, [a.key]: !!v })} />
              {a.label}
            </label>
          ))}
        </div>
        <div className="space-y-1 pt-2">
          <Label className="text-xs">Digite <code>EXCLUIR</code> para confirmar</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" className="max-w-xs" />
        </div>
        <div className="pt-1">
          <Button
            variant="destructive"
            disabled={busy || chosen.length === 0 || confirmText.trim().toUpperCase() !== "EXCLUIR"}
            onClick={doDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir {chosen.length > 0 ? `${chosen.length} área(s)` : "dados"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
