import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, Search, Download, BookOpen, ScanLine, Upload, FileDown, Sparkles, Wand2, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { fetchBookByIsbn } from "@/lib/openlibrary.functions";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { ExportCsvDialog } from "@/components/ExportCsvDialog";
import { BulkEditDialog } from "@/components/BulkEditDialog";
import { useResizableColumns, Resizer } from "@/lib/use-resizable-columns";
import { suggestTitle, suggestAuthor } from "@/lib/text-suggest";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Acervo — Biblioteca" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ new: s.new ? 1 : undefined }) as { new?: 1 },
  component: BooksPage,
});

type BookForm = {
  id?: string;
  titulo: string; autor: string; isbn: string; editora: string; ano: string; numero_paginas: string;
  idioma: string; sinopse: string; capa_url: string; quantidade_total: string;
  localizacao_prateleira: string; categoria_id: string;
};

const emptyForm: BookForm = {
  titulo: "", autor: "", isbn: "", editora: "", ano: "", numero_paginas: "",
  idioma: "", sinopse: "", capa_url: "", quantidade_total: "1", localizacao_prateleira: "", categoria_id: "",
};

const COL_DEFAULTS = {
  select: 36, capa: 64, titulo: 240, autor: 180, categoria: 140, prateleira: 140, qtd: 110, acoes: 110,
};

function BooksPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const importIsbn = useServerFn(fetchBookByIsbn);
  const { widths, startResize, reset: resetCols } = useResizableColumns("books-cols-v1", COL_DEFAULTS);
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  useEffect(() => {
    if (searchParams.new) {
      setForm(emptyForm);
      setOpen(true);
      navigate({ to: "/books", search: {} as any, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.new]);

  const { data: books = [] } = useQuery({
    queryKey: ["books-admin", search],
    queryFn: async () => {
      let q = supabase.from("books").select("*, categories(nome)").order("titulo");
      if (search.trim()) q = q.or(`titulo.ilike.%${search}%,autor.ilike.%${search}%,isbn.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
  });

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
  });

  const titleSuggest = useMemo(() => suggestTitle(form.titulo || ""), [form.titulo]);
  const authorSuggest = useMemo(() => suggestAuthor(form.autor || ""), [form.autor]);

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (b: any) => {
    setForm({
      id: b.id, titulo: b.titulo, autor: b.autor, isbn: b.isbn ?? "", editora: b.editora ?? "",
      ano: b.ano?.toString() ?? "", numero_paginas: b.numero_paginas?.toString() ?? "",
      idioma: b.idioma ?? "", sinopse: b.sinopse ?? "", capa_url: b.capa_url ?? "",
      quantidade_total: b.quantidade_total?.toString() ?? "1",
      localizacao_prateleira: b.localizacao_prateleira ?? "", categoria_id: b.categoria_id ?? "",
    });
    setOpen(true);
  };

  const importByIsbn = async (isbnOverride?: string) => {
    const isbn = isbnOverride ?? form.isbn;
    if (!isbn) return toast.error("Informe ou escaneie um código primeiro");
    setIsbnLoading(true);
    try {
      const r = await importIsbn({ data: { isbn } });
      if (!r.found) return toast.error("Código não encontrado (Open Library / Google Books). Preencha manualmente.");
      setForm((f) => ({
        ...f,
        isbn: r.isbn || f.isbn,
        titulo: r.titulo || f.titulo,
        autor: r.autor || f.autor,
        editora: r.editora || f.editora,
        ano: r.ano?.toString() ?? f.ano,
        numero_paginas: r.numero_paginas?.toString() ?? f.numero_paginas,
        capa_url: r.capa_url || f.capa_url,
        sinopse: r.sinopse || f.sinopse,
      }));
      toast.success("Dados preenchidos automaticamente");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setIsbnLoading(false);
    }
  };

  const onScanned = (code: string) => {
    setForm((f) => ({ ...f, isbn: code }));
    setScannerOpen(false);
    toast.success(`Código lido: ${code}`);
    importByIsbn(code);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) return toast.error("Título obrigatório");
    const qtd = Math.max(1, parseInt(form.quantidade_total) || 1);
    const payload: any = {
      titulo: form.titulo.trim(),
      autor: form.autor.trim(),
      isbn: form.isbn.trim() || null,
      editora: form.editora.trim() || null,
      ano: form.ano ? parseInt(form.ano) : null,
      numero_paginas: form.numero_paginas ? parseInt(form.numero_paginas) : null,
      idioma: form.idioma.trim() || null,
      sinopse: form.sinopse.trim() || null,
      capa_url: form.capa_url.trim() || null,
      localizacao_prateleira: form.localizacao_prateleira.trim() || null,
      categoria_id: form.categoria_id || null,
      quantidade_total: qtd,
    };
    if (form.id) {
      const { error } = await supabase.from("books").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
      toast.success("Livro atualizado");
    } else {
      payload.quantidade_disponivel = qtd;
      const { error } = await supabase.from("books").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Livro cadastrado");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["books-admin"] });
    qc.invalidateQueries({ queryKey: ["books-catalog"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este livro?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Livro excluído");
    qc.invalidateQueries({ queryKey: ["books-admin"] });
  };

  const lastIndexRef = useRef<number | null>(null);
  const shiftRef = useRef(false);

  const toggleSelect = (id: string, index: number) => {
    const next = new Set(selected);
    if (shiftRef.current && lastIndexRef.current !== null) {
      const [a, b] = [lastIndexRef.current, index].sort((x, y) => x - y);
      const shouldSelect = !next.has(id);
      for (let i = a; i <= b; i++) {
        const rid = books[i]?.id;
        if (!rid) continue;
        if (shouldSelect) next.add(rid); else next.delete(rid);
      }
    } else {
      if (next.has(id)) next.delete(id); else next.add(id);
    }
    lastIndexRef.current = index;
    setSelected(next);
  };
  const toggleAll = () => {
    lastIndexRef.current = null;
    if (selected.size === books.length) setSelected(new Set());
    else setSelected(new Set(books.map((b: any) => b.id)));
  };


  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} livro(s)?`)) return;
    const { error } = await supabase.from("books").delete().in("id", Array.from(selected));
    if (error) return toast.error(error.message);
    toast.success(`${selected.size} livro(s) excluído(s)`);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["books-admin"] });
  };

  const doMerge = async () => {
    if (selected.size !== 2 || !mergeTargetId) return;
    const ids = Array.from(selected);
    const sourceId = ids.find((i) => i !== mergeTargetId)!;
    const { error } = await supabase.rpc("merge_books", { _target_id: mergeTargetId, _source_id: sourceId });
    if (error) return toast.error(error.message);
    toast.success("Livros mesclados");
    setMergeOpen(false);
    setSelected(new Set());
    qc.invalidateQueries({ queryKey: ["books-admin"] });
  };

  const headerCell = (key: keyof typeof COL_DEFAULTS, label: string, extra: string = "") => (
    <TableHead
      style={{ width: widths[key], minWidth: widths[key] }}
      className={`relative ${extra}`}
    >
      {label}
      <Resizer onMouseDown={startResize(key)} />
    </TableHead>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Acervo</h1>
          <p className="text-muted-foreground text-sm">Gerencie os livros da biblioteca</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCsvOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar CSV</Button>
          <Button variant="outline" onClick={() => setExportOpen(true)}><FileDown className="h-4 w-4 mr-2" />Exportar CSV</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Livro</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-4 bg-card/95 backdrop-blur border-b border-border/60 flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, autor ou ISBN" className="pl-9 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selected.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
                  <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}><Wand2 className="h-3 w-3 mr-1" />Editar em massa</Button>
                  {selected.size === 2 && (
                    <Button size="sm" variant="outline" onClick={() => { setMergeTargetId(Array.from(selected)[0]); setMergeOpen(true); }}>
                      <GitMerge className="h-3 w-3 mr-1" />Mesclar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={bulkDelete}><Trash2 className="h-3 w-3 mr-1" />Excluir</Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={resetCols} title="Restaurar larguras das colunas">Reset colunas</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: "fixed" }}>
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: widths.select, minWidth: widths.select }} className="relative">
                    <Checkbox checked={books.length > 0 && selected.size === books.length} onCheckedChange={toggleAll} />
                    <Resizer onMouseDown={startResize("select")} />
                  </TableHead>
                  {headerCell("capa", "Capa")}
                  {headerCell("titulo", "Título")}
                  {headerCell("autor", "Autor")}
                  {headerCell("categoria", "Categoria")}
                  {headerCell("prateleira", "Prateleira")}
                  {headerCell("qtd", "Disp./Total", "text-center")}
                  {headerCell("acoes", "Ações", "text-right")}
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum livro cadastrado</TableCell></TableRow>
                ) : books.map((b: any) => (
                  <TableRow key={b.id} data-state={selected.has(b.id) ? "selected" : undefined}>
                    <TableCell><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} /></TableCell>
                    <TableCell>
                      {b.capa_url ? (
                        <img src={b.capa_url} alt={b.titulo} className="h-12 w-9 object-cover rounded shadow-sm" loading="lazy" />
                      ) : (
                        <div className="h-12 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium truncate" title={b.titulo}>{b.titulo}</TableCell>
                    <TableCell className="truncate" title={b.autor}>{b.autor}</TableCell>
                    <TableCell className="text-muted-foreground truncate">{b.categories?.nome ?? "—"}</TableCell>
                    <TableCell className="truncate">{b.localizacao_prateleira ?? "—"}</TableCell>
                    <TableCell className="text-center">{b.quantidade_disponivel}/{b.quantidade_total}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Editar Livro" : "Novo Livro"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2 flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[180px] space-y-1">
                <Label>ISBN / Código de barras</Label>
                <Input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
              </div>
              <Button type="button" variant="secondary" onClick={() => importByIsbn()} disabled={isbnLoading}>
                <Download className="h-4 w-4 mr-2" />{isbnLoading ? "Buscando..." : "Buscar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-2" />Escanear
              </Button>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Título *</Label>
              <Input lang="pt-BR" spellCheck value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              {titleSuggest && (
                <button type="button" onClick={() => setForm({ ...form, titulo: titleSuggest })}
                  className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
                  <Sparkles className="h-3 w-3" />Sugestão: <strong>{titleSuggest}</strong> (clique para aplicar)
                </button>
              )}
            </div>
            <div className="space-y-1">
              <Label>Autor</Label>
              <Input lang="pt-BR" spellCheck value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} />
              {authorSuggest && (
                <button type="button" onClick={() => setForm({ ...form, autor: authorSuggest })}
                  className="text-xs inline-flex items-center gap-1 text-primary hover:underline">
                  <Sparkles className="h-3 w-3" />Sugestão: <strong>{authorSuggest}</strong>
                </button>
              )}
            </div>
            <div className="space-y-1"><Label>Editora</Label><Input value={form.editora} onChange={(e) => setForm({ ...form, editora: e.target.value })} /></div>
            <div className="space-y-1"><Label>Ano</Label><Input type="number" value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })} /></div>
            <div className="space-y-1"><Label>Páginas</Label><Input type="number" value={form.numero_paginas} onChange={(e) => setForm({ ...form, numero_paginas: e.target.value })} /></div>
            <div className="space-y-1"><Label>Idioma</Label><Input value={form.idioma} onChange={(e) => setForm({ ...form, idioma: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.categoria_id || "none"} onValueChange={(v) => setForm({ ...form, categoria_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Quantidade Total</Label><Input type="number" min={1} value={form.quantidade_total} onChange={(e) => setForm({ ...form, quantidade_total: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Estante / Prateleira</Label>
              <Select value={form.localizacao_prateleira || "none"} onValueChange={(v) => setForm({ ...form, localizacao_prateleira: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhuma —</SelectItem>
                  {shelves.map((s: any) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1"><Label>URL da Capa</Label><Input value={form.capa_url} onChange={(e) => setForm({ ...form, capa_url: e.target.value })} /></div>
            <div className="md:col-span-2 space-y-1"><Label>Sinopse</Label><Textarea lang="pt-BR" spellCheck rows={3} value={form.sinopse} onChange={(e) => setForm({ ...form, sinopse: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={onScanned} />
      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
      <ExportCsvDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <BulkEditDialog open={bulkOpen} onClose={() => { setBulkOpen(false); setSelected(new Set()); }} bookIds={Array.from(selected)} />

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mesclar livros duplicados</DialogTitle>
            <DialogDescription>
              Escolha qual registro será mantido. As quantidades, empréstimos e etiquetas do outro serão transferidos, e o registro descartado será excluído.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={mergeTargetId} onValueChange={setMergeTargetId} className="space-y-2">
            {Array.from(selected).map((id) => {
              const b = books.find((x: any) => x.id === id);
              if (!b) return null;
              return (
                <label key={id} className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value={id} className="mt-1" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{b.titulo}</div>
                    <div className="text-muted-foreground">{b.autor || "—"} · Disp/Total: {b.quantidade_disponivel}/{b.quantidade_total}</div>
                    {b.isbn && <div className="text-xs text-muted-foreground">ISBN {b.isbn}</div>}
                  </div>
                </label>
              );
            })}
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancelar</Button>
            <Button onClick={doMerge} disabled={!mergeTargetId}>Mesclar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
