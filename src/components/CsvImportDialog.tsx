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
import { parseLibibCsv, rowToBook, type LibibBookCandidate } from "@/lib/libib-csv";

type Resolution = "skip" | "import" | "overwrite";
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

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
  });

  const processFile = async (f: File) => {
    setProgress({ current: 0, total: 0, phase: "Lendo arquivo..." });
    const text = await f.text();
    const parsed = parseLibibCsv(text);
    if (!parsed.length) { setProgress(null); return toast.error("Nenhuma linha válida encontrada"); }

    setProgress({ current: 0, total: parsed.length, phase: "Verificando duplicatas..." });
    const candidates = parsed.map(rowToBook);
    const isbns = candidates.map((c) => c.isbn).filter(Boolean) as string[];
    const titles = candidates.map((c) => c.titulo.toLowerCase());

    const { data: existing } = await supabase
      .from("books")
      .select("id, titulo, autor, isbn")
      .or(`isbn.in.(${isbns.length ? isbns.map((i) => `"${i}"`).join(",") : '""'}),titulo.in.(${titles.map((t) => `"${t.replace(/"/g, "")}"`).join(",")})`);

    const dupBy = (c: LibibBookCandidate) => {
      const list = existing ?? [];
      return list.find((b) =>
        (c.isbn && b.isbn && b.isbn === c.isbn) ||
        (b.titulo?.toLowerCase() === c.titulo.toLowerCase() && (b.autor ?? "").toLowerCase() === (c.autor ?? "").toLowerCase()),
      ) ?? null;
    };

    setRows(candidates.map((c) => {
      const dup = dupBy(c);
      return { ...c, dup, resolution: dup ? "skip" : "import", selected: true };
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

      setProgress({ current: 0, total: work.length, phase: "Resolvendo categorias..." });
      const neededCats = Array.from(new Set(work.filter((r) => r.categoria_nome).map((r) => r.categoria_nome!)));
      const catMap = new Map<string, string>();
      (categories as any[]).forEach((c) => catMap.set(c.nome.toLowerCase(), c.id));
      for (const name of neededCats) {
        if (!catMap.has(name.toLowerCase())) {
          const { data } = await supabase.from("categories").insert({ nome: name }).select().single();
          if (data) catMap.set(name.toLowerCase(), data.id);
        }
      }

      let imported = 0, updated = 0, skipped = rows.length - work.length, done = 0;
      for (const r of work) {
        done++;
        setProgress({ current: done, total: work.length, phase: `Importando ${done} de ${work.length}: ${r.titulo.slice(0, 40)}` });
        const payload: any = {
          titulo: r.titulo, autor: r.autor, isbn: r.isbn, editora: r.editora,
          ano: r.ano, numero_paginas: r.numero_paginas, sinopse: r.sinopse,
          quantidade_total: r.quantidade_total, localizacao_prateleira: shelfName,
          categoria_id: r.categoria_nome ? catMap.get(r.categoria_nome.toLowerCase()) ?? null : null,
        };
        if (r.resolution === "overwrite" && r.dup) {
          const { error } = await supabase.from("books").update(payload).eq("id", r.dup.id);
          if (!error) updated++;
        } else {
          payload.quantidade_disponivel = r.quantidade_total;
          const { error } = await supabase.from("books").insert(payload);
          if (!error) imported++;
        }
      }
      toast.success(`Importação concluída: ${imported} adicionados, ${updated} atualizados, ${skipped} ignorados`);
      qc.invalidateQueries({ queryKey: ["books-admin"] });
      qc.invalidateQueries({ queryKey: ["books-catalog"] });
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
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{rows.length} linhas</Badge>
              <Badge variant={dupCount ? "destructive" : "secondary"}>{dupCount} duplicatas</Badge>
              <Badge>{selCount} a importar</Badge>
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
                  {rows.map((r, i) => (
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
                            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Ignorar (duplicata)</SelectItem>
                              <SelectItem value="overwrite">Sobrescrever existente</SelectItem>
                              <SelectItem value="import">Importar mesmo assim</SelectItem>
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
