import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props { open: boolean; onClose: () => void; bookIds: string[] }

type Patch = {
  categoria_id?: string | null;
  localizacao_prateleira?: string | null;
  editora?: string;
  ano?: number | null;
  idioma?: string;
  quantidade_total?: number;
};

export function BulkEditDialog({ open, onClose, bookIds }: Props) {
  const qc = useQueryClient();
  const [enable, setEnable] = useState<Record<string, boolean>>({});
  const [shelf, setShelf] = useState("none");
  const [cat, setCat] = useState("none");
  const [editora, setEditora] = useState("");
  const [ano, setAno] = useState("");
  const [idioma, setIdioma] = useState("");
  const [qtd, setQtd] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
    enabled: open,
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
    enabled: open,
  });

  const apply = async () => {
    const patch: Patch = {};
    if (enable.shelf) patch.localizacao_prateleira = shelf === "none" ? null : shelf;
    if (enable.cat) patch.categoria_id = cat === "none" ? null : cat;
    if (enable.editora) patch.editora = editora.trim();
    if (enable.ano) patch.ano = ano ? parseInt(ano) : null;
    if (enable.idioma) patch.idioma = idioma.trim();
    if (enable.qtd) {
      const n = Math.max(1, parseInt(qtd) || 1);
      patch.quantidade_total = n;
    }
    if (Object.keys(patch).length === 0) return toast.error("Selecione ao menos um campo para alterar");
    setLoading(true);
    try {
      const { error } = await supabase.from("books").update(patch as any).in("id", bookIds);
      if (error) throw error;
      toast.success(`${bookIds.length} livro(s) atualizado(s)`);
      qc.invalidateQueries({ queryKey: ["books-admin"] });
      qc.invalidateQueries({ queryKey: ["books-catalog"] });
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const Field = ({ id, label, children }: any) => (
    <div className="grid grid-cols-[auto_1fr] items-center gap-3 py-1">
      <Checkbox checked={!!enable[id]} onCheckedChange={(v) => setEnable({ ...enable, [id]: !!v })} />
      <div className="space-y-1">
        <Label className={enable[id] ? "" : "text-muted-foreground"}>{label}</Label>
        <div className={enable[id] ? "" : "opacity-50 pointer-events-none"}>{children}</div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edição em massa — {bookIds.length} livro(s) selecionado(s)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Marque os campos que deseja alterar. Os demais ficarão intactos.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Field id="shelf" label="Estante">
            <Select value={shelf} onValueChange={setShelf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Remover —</SelectItem>
                {shelves.map((s: any) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="cat" label="Categoria">
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Remover —</SelectItem>
                {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field id="editora" label="Editora"><Input value={editora} onChange={(e) => setEditora(e.target.value)} /></Field>
          <Field id="ano" label="Ano"><Input type="number" value={ano} onChange={(e) => setAno(e.target.value)} /></Field>
          <Field id="idioma" label="Idioma"><Input value={idioma} onChange={(e) => setIdioma(e.target.value)} /></Field>
          <Field id="qtd" label="Quantidade total"><Input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={apply} disabled={loading}>{loading ? "Aplicando..." : "Aplicar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
