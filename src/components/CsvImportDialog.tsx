import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bookDedupKey, normalizeBookText, normalizeIsbn, parseLibibCsv, rowToBook, type LibibBookCandidate } from "@/lib/libib-csv";

type Resolution = "skip" | "import" | "overwrite" | "merge";
type Row = LibibBookCandidate & { dup: any | null; resolution: Resolution; selected: boolean };

interface Props { open: boolean; onClose: () => void }

export function CsvImportDialog({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [shelf, setShelf] = useState<string>("none");
  const [newShelf, setNewShelf] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [sortBy, setSortBy] = useState<"original" | "status" | "resolution" | "titulo" | "autor">("status");

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
  });

  const processFile = async (f: File) => {
    setFilename(f.name);
    setProgress({ current: 0, total: 0, phase: "Lendo arquivo..." });
    const text = await f.text();
    const parsed = parseLibibCsv(text);
    if (!parsed.length) { setProgress(null); return toast.error("Nenhuma linha válida encontrada"); }

    setProgress({ current: 0, total: parsed.length, phase: "Verificando duplicatas..." });
    const candidates = parsed.map(rowToBook);

    // Paginado: PostgREST devolve no máximo 1000 linhas por requisição.
    const existing = await fetchAllBooks<any>("id, titulo, autor, isbn");
    const existingByKey = new Map<string, any>();
    (existing ?? []).forEach((b: any) => {
      const isbnKey = normalizeIsbn(b.isbn);
      if (isbnKey) existingByKey.set(`isbn:${isbnKey}`, b);
      existingByKey.set(`title:${normalizeBookText(b.titulo)}|author:${normalizeBookText(b.autor)}`, b);
    });
    const seenInFile = new Map<string, LibibBookCandidate>();

    const dupBy = (c: LibibBookCandidate) => {
      const key = bookDedupKey(c);
      const dup = existingByKey.get(key) ?? (seenInFile.has(key) ? { id: `arquivo-${key}`, titulo: seenInFile.get(key)?.titulo, autor: seenInFile.get(key)?.autor, isbn: seenInFile.get(key)?.isbn } : null);
      if (!seenInFile.has(key)) seenInFile.set(key, c);
      return dup;
    };

    setRows(candidates.map((c) => {
      const dup = dupBy(c);
      // Default: each CSV row becomes its own book record (never silently merged)
      return { ...c, dup, resolution: "import", selected: true };
    }));
    setProgress(null);
    toast.success(`${candidates.length} linhas carregadas`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) await processFile(f);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && /\.csv$/i.test(f.name)) await processFile(f);
    else toast.error("Solte um arquivo .csv");
  };

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const handleImport = async () => {
    setLoading(true);
    const work = rows.filter((r) => r.selected && r.resolution !== "skip");
    setProgress({ current: 0, total: work.length, phase: "Preparando..." });
    try {
      let shelfName: string | null = null;
      if (newShelf.trim()) {
        const { data, error } = await supabase.from("shelves").insert({ nome: newShelf.trim() }).select().single();
        if (error) throw new Error(error.message);
        shelfName = data.nome;
        qc.invalidateQueries({ queryKey: ["shelves"] });
      } else if (shelf !== "none") {
        shelfName = shelf;
      }

      setProgress({ current: work.length, total: work.length, phase: "Gravando lote com verificação de duplicatas..." });
      const payload = work.map((r) => ({ ...r, localizacao_prateleira: shelfName, resolution: r.resolution }));
      const { data, error } = await supabase.rpc("import_books_batch", { _items: payload as any });
      if (error) throw new Error(error.message);
      const result: any = data ?? {};
      toast.success(`Importação concluída: ${result.imported ?? 0} adicionados, ${result.updated ?? 0} atualizados, ${result.merged ?? 0} somados, ${result.skipped ?? 0} ignorados`);
      qc.invalidateQueries({ queryKey: ["books-admin"] });
      qc.invalidateQueries({ queryKey: ["books-catalog"] });
      qc.invalidateQueries({ queryKey: ["all-books-stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["loan-history"] });
      qc.invalidateQueries({ queryKey: ["loans-global-history"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["shelves"] });
      setRows([]);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const dupCount = rows.filter((r) => r.dup).length;
  const selCount = rows.filter((r) => r.selected && r.resolution !== "skip").length;

  const resOrder: Record<Resolution, number> = { merge: 0, overwrite: 1, import: 2, skip: 3 };
  const displayRows = rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      switch (sortBy) {
        case "status": {
          const av = a.r.dup ? 0 : 1, bv = b.r.dup ? 0 : 1;
          return av !== bv ? av - bv : a.i - b.i;
        }
        case "resolution": {
          const av = a.r.dup ? resOrder[a.r.resolution] : 4;
          const bv = b.r.dup ? resOrder[b.r.resolution] : 4;
          return av !== bv ? av - bv : a.i - b.i;
        }
        case "titulo": return a.r.titulo.localeCompare(b.r.titulo, "pt-BR");
        case "autor": return (a.r.autor || "").localeCompare(b.r.autor || "", "pt-BR");
        default: return a.i - b.i;
      }
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar acervo (CSV no formato Libib)</DialogTitle>
        </DialogHeader>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed p-4 text-center transition ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"}`}
        >
          <p className="text-sm font-medium">Arraste e solte um arquivo CSV aqui</p>
          <p className="text-xs text-muted-foreground mb-2">ou selecione manualmente abaixo</p>
          <Input type="file" accept=".csv,text/csv" onChange={handleFile} className="max-w-sm mx-auto" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Estante existente (aplicada aos livros importados)</Label>
            <Select value={shelf} onValueChange={setShelf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhuma —</SelectItem>
                {shelves.map((s: any) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>...ou criar nova estante</Label>
            <Input placeholder="Ex.: Crítica Literária" value={newShelf} onChange={(e) => setNewShelf(e.target.value)} />
          </div>
        </div>

        {progress && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.phase}</span>
              {progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : "100%" }}
              />
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{rows.length} linhas</Badge>
              <Badge variant={dupCount ? "destructive" : "secondary"}>{dupCount} duplicatas</Badge>
              <Badge>{selCount} a importar</Badge>
              <div className="ml-auto flex items-center gap-2">
                <Label className="text-xs">Ordenar por</Label>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status (duplicatas primeiro)</SelectItem>
                    <SelectItem value="resolution">Ação escolhida</SelectItem>
                    <SelectItem value="titulo">Título (A–Z)</SelectItem>
                    <SelectItem value="autor">Autor (A–Z)</SelectItem>
                    <SelectItem value="original">Ordem original do arquivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Autor</TableHead>
                    <TableHead>ISBN</TableHead>
                    <TableHead>Coleção</TableHead>
                    <TableHead>Status / Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map(({ r, i }) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox checked={r.selected} onCheckedChange={(v) => setRow(i, { selected: !!v })} />
                      </TableCell>
                      <TableCell className="font-medium max-w-[260px] truncate" title={r.titulo}>{r.titulo}</TableCell>
                      <TableCell className="text-sm">{r.autor}</TableCell>
                      <TableCell className="text-xs font-mono">{r.isbn ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.categoria_nome ?? "—"}</TableCell>
                      <TableCell>
                        {r.dup ? (
                          <Select value={r.resolution} onValueChange={(v: any) => setRow(i, { resolution: v })}>
                            <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="import">Criar novo registro (recomendado)</SelectItem>
                              <SelectItem value="merge">Somar como exemplar do existente</SelectItem>
                              <SelectItem value="overwrite">Atualizar dados sem somar</SelectItem>
                              <SelectItem value="skip">Ignorar</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : <Badge variant="secondary">Novo</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={loading || selCount === 0}>
            {loading ? "Importando..." : `Importar ${selCount}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
