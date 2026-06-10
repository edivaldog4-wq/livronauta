import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { booksToLibibCsv, downloadText } from "@/lib/libib-csv";
import { toast } from "sonner";

interface Props { open: boolean; onClose: () => void }

export function ExportCsvDialog({ open, onClose }: Props) {
  const [shelves, setShelves] = useState<Set<string>>(new Set());
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [allShelves, setAllShelves] = useState(true);
  const [allCats, setAllCats] = useState(true);
  const [loading, setLoading] = useState(false);

  const { data: shelvesList = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
    enabled: open,
  });
  const { data: catsList = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
    enabled: open,
  });

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    setter(next);
  };

  const doExport = async () => {
    setLoading(true);
    try {
      let q = supabase.from("books").select("*, categories(nome)").order("titulo");
      if (!allShelves && shelves.size > 0) q = q.in("localizacao_prateleira", Array.from(shelves));
      if (!allCats && cats.size > 0) q = q.in("categoria_id", Array.from(cats));
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) { toast.error("Nenhum livro corresponde aos filtros"); return; }
      downloadText(`library_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.csv`, booksToLibibCsv(data));
      toast.success(`${data.length} livros exportados`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Exportar acervo (CSV Libib)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Estantes</Label>
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={allShelves} onCheckedChange={(v) => setAllShelves(!!v)} />Todas</label>
            </div>
            <ScrollArea className="h-56 rounded border p-2">
              {shelvesList.length === 0 ? <p className="text-xs text-muted-foreground">Sem estantes</p> :
                shelvesList.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 py-1 text-sm">
                    <Checkbox disabled={allShelves} checked={shelves.has(s.nome)} onCheckedChange={() => toggle(shelves, setShelves, s.nome)} />
                    {s.nome}
                  </label>
                ))}
            </ScrollArea>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Categorias</Label>
              <label className="flex items-center gap-2 text-xs"><Checkbox checked={allCats} onCheckedChange={(v) => setAllCats(!!v)} />Todas</label>
            </div>
            <ScrollArea className="h-56 rounded border p-2">
              {catsList.map((c: any) => (
                <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
                  <Checkbox disabled={allCats} checked={cats.has(c.id)} onCheckedChange={() => toggle(cats, setCats, c.id)} />
                  {c.nome}
                </label>
              ))}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={doExport} disabled={loading}>{loading ? "Exportando..." : "Exportar CSV"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
