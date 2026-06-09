import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2, Search, Download, BookOpen, ScanLine, Upload, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { fetchBookByIsbn } from "@/lib/openlibrary.functions";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { CsvImportDialog } from "@/components/CsvImportDialog";
import { booksToLibibCsv, downloadText } from "@/lib/libib-csv";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Acervo — Biblioteca" }] }),
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

function BooksPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BookForm>(emptyForm);
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const importIsbn = useServerFn(fetchBookByIsbn);

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
      if (!r.found) return toast.error("Código não encontrado na Open Library");
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
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este livro?")) return;
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Livro excluído");
    qc.invalidateQueries({ queryKey: ["books-admin"] });
  };

  const exportCsv = async () => {
    const { data } = await supabase.from("books").select("*, categories(nome)").order("titulo");
    if (!data?.length) return toast.error("Nenhum livro para exportar");
    downloadText(`library_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.csv`, booksToLibibCsv(data));
    toast.success(`${data.length} livros exportados`);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Acervo</h1>
          <p className="text-muted-foreground text-sm">Gerencie os livros da biblioteca</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setCsvOpen(true)}><Upload className="h-4 w-4 mr-2" />Importar CSV</Button>
          <Button variant="outline" onClick={exportCsv}><FileDown className="h-4 w-4 mr-2" />Exportar CSV</Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Livro</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por título, autor ou ISBN" className="pl-9 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Capa</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prateleira</TableHead>
                  <TableHead className="text-center">Disp. / Total</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {books.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum livro cadastrado</TableCell></TableRow>
                ) : books.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.capa_url ? (
                        <img src={b.capa_url} alt={b.titulo} className="h-12 w-9 object-cover rounded shadow-sm" loading="lazy" />
                      ) : (
                        <div className="h-12 w-9 rounded bg-muted flex items-center justify-center text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{b.titulo}</TableCell>
                    <TableCell>{b.autor}</TableCell>
                    <TableCell className="text-muted-foreground">{b.categories?.nome ?? "—"}</TableCell>
                    <TableCell>{b.localizacao_prateleira ?? "—"}</TableCell>
                    <TableCell className="text-center">{b.quantidade_disponivel}/{b.quantidade_total}</TableCell>
                    <TableCell className="text-right">
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
            <div className="md:col-span-2 space-y-1"><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div className="space-y-1"><Label>Autor</Label><Input value={form.autor} onChange={(e) => setForm({ ...form, autor: e.target.value })} /></div>
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
            <div className="md:col-span-2 space-y-1"><Label>Sinopse</Label><Textarea rows={3} value={form.sinopse} onChange={(e) => setForm({ ...form, sinopse: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={onScanned} />
      <CsvImportDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  );
}
