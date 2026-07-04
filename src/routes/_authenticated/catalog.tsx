import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, BookOpen, LogIn, Library as LibIcon, CheckCircle2, Tags, UserCircle2, RotateCcw, Send, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/AppLayout";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useLibraryName } from "@/lib/library";
import { useServerFn } from "@tanstack/react-start";
import { requestLoan, returnLoan } from "@/lib/loans.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({ meta: [{ title: "Catálogo — Biblioteca" }] }),
  component: CatalogPage,
});

const PAGE_SIZE = 24;

function CatalogPage() {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const libraryName = useLibraryName();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [availability, setAvailability] = useState<string>("all");
  const [shelf, setShelf] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const reqLoan = useServerFn(requestLoan);
  const retLoan = useServerFn(returnLoan);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
  });

  const { data: shelves = [] } = useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await supabase.from("shelves").select("*").order("nome")).data ?? [],
  });

  const {
    data: pages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["books-catalog", search, categoryId, availability, shelf],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let q = supabase.from("books").select("*, categories(nome)").order("titulo").range(from, to);
      if (search.trim()) q = q.or(`titulo.ilike.%${search}%,autor.ilike.%${search}%,isbn.ilike.%${search}%`);
      if (categoryId !== "all") q = q.eq("categoria_id", categoryId);
      if (availability === "available") q = q.gt("quantidade_disponivel", 0);
      if (availability === "unavailable") q = q.eq("quantidade_disponivel", 0);
      if (shelf !== "all") q = q.eq("localizacao_prateleira", shelf);
      const { data } = await q;
      return { rows: data ?? [], next: (data?.length ?? 0) === PAGE_SIZE ? (pageParam as number) + 1 : null };
    },
    getNextPageParam: (last) => last.next,
  });

  const books = useMemo(() => (pages?.pages ?? []).flatMap((p) => p.rows), [pages]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);


  // Active loans of current user — to know which cards show "Devolver"
  const { data: myActiveLoans = [] } = useQuery({
    queryKey: ["my-active-loans", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("loans").select("id, book_id").eq("user_id", user!.id).eq("status", "ativo")).data ?? [],
  });

  // Active loans visible to staff for any book — to show "Devolver" on every borrowed card
  const { data: allActiveLoans = [] } = useQuery({
    queryKey: ["all-active-loans"],
    enabled: !!user && isStaff,
    queryFn: async () => (await supabase.from("loans").select("id, book_id").eq("status", "ativo")).data ?? [],
  });

  // User pending requests
  const { data: myPending = [] } = useQuery({
    queryKey: ["my-pending-requests", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("loan_requests").select("book_id").eq("user_id", user!.id).eq("status", "pendente")).data ?? [],
  });

  const myLoanByBook = new Map(myActiveLoans.map((l: any) => [l.book_id, l.id]));
  const anyLoanByBook = new Map(allActiveLoans.map((l: any) => [l.book_id, l.id]));
  const pendingBooks = new Set(myPending.map((r: any) => r.book_id));

  const { data: allBooks = [] } = useQuery({
    queryKey: ["all-books-stats"],
    queryFn: async () => (await supabase.from("books").select("autor, quantidade_total, quantidade_disponivel, categories(nome)")).data ?? [],
  });

  const stats = (() => {
    const totalLivros = allBooks.reduce((s: number, b: any) => s + (b.quantidade_total ?? 0), 0);
    const disponiveis = allBooks.reduce((s: number, b: any) => s + (b.quantidade_disponivel ?? 0), 0);
    const autores = new Set(allBooks.map((b: any) => (b.autor ?? "").trim()).filter(Boolean)).size;
    const catMap: Record<string, number> = {};
    allBooks.forEach((b: any) => {
      const n = b.categories?.nome ?? "Sem categoria";
      catMap[n] = (catMap[n] ?? 0) + (b.quantidade_total ?? 0);
    });
    const chart = Object.entries(catMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total).slice(0, 8);
    return { totalLivros, disponiveis, autores, categorias: Object.keys(catMap).length, chart };
  })();

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["books-catalog"] });
    qc.invalidateQueries({ queryKey: ["all-books-stats"] });
    qc.invalidateQueries({ queryKey: ["my-active-loans"] });
    qc.invalidateQueries({ queryKey: ["all-active-loans"] });
    qc.invalidateQueries({ queryKey: ["my-pending-requests"] });
    qc.invalidateQueries({ queryKey: ["my-loans"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["loans-global-history"] });
    qc.invalidateQueries({ queryKey: ["pending-requests"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const handleRequest = async (bookId: string) => {
    try {
      await reqLoan({ data: { book_id: bookId } });
      toast.success("Solicitação enviada! Aguarde aprovação.");
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReturn = async (loanId: string) => {
    if (!confirm("Confirmar devolução deste livro?")) return;
    try {
      const r = await retLoan({ data: { loan_id: loanId } });
      if (r.multa > 0) toast.warning(`Devolução registrada. Multa: R$ ${r.multa.toFixed(2)}`);
      else toast.success("Devolução registrada");
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveEditing = async () => {
    if (!editing?.titulo?.trim()) return toast.error("Título obrigatório");
    const { error } = await supabase.from("books").update({
      titulo: editing.titulo.trim(),
      autor: editing.autor?.trim() ?? "",
      isbn: editing.isbn?.trim() || null,
      editora: editing.editora?.trim() || null,
      ano: editing.ano ? Number(editing.ano) : null,
      numero_paginas: editing.numero_paginas ? Number(editing.numero_paginas) : null,
      sinopse: editing.sinopse?.trim() || null,
      localizacao_prateleira: editing.localizacao_prateleira || null,
      categoria_id: editing.categoria_id || null,
      quantidade_total: Math.max(1, Number(editing.quantidade_total) || 1),
    }).eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success("Livro atualizado");
    setEditing(null);
    invalidateAll();
    qc.invalidateQueries({ queryKey: ["books-admin"] });
  };

  const content = (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{libraryName}</h1>
          <p className="text-muted-foreground text-sm">{books.length}{hasNextPage ? "+" : ""} {books.length === 1 ? "livro" : "livros"} carregado{books.length === 1 ? "" : "s"}</p>
        </div>
        {!user && (
          <Button asChild><Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Entrar</Link></Button>
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatTile icon={LibIcon} label="Exemplares" value={stats.totalLivros} />
        <StatTile icon={CheckCircle2} label="Disponíveis" value={stats.disponiveis} />
        <StatTile icon={Tags} label="Categorias" value={stats.categorias} />
        <StatTile icon={UserCircle2} label="Autores" value={stats.autores} />
      </div>
      {stats.chart.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-3">Distribuição por categoria</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer>
                <BarChart data={stats.chart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="nome" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis fontSize={10} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por título, autor ou ISBN" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={availability} onValueChange={setAvailability}>
              <SelectTrigger><SelectValue placeholder="Disponibilidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="unavailable">Emprestados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {shelves.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShelf("all")}
                className={`text-xs px-3 py-1 rounded-full border transition ${shelf === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
              >Todas as estantes</button>
              {shelves.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShelf(s.nome === shelf ? "all" : s.nome)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${shelf === s.nome ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}
                >{s.nome}</button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      ) : books.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum livro encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map((b: any) => {
            const myLoanId = myLoanByBook.get(b.id);
            const anyLoanId = anyLoanByBook.get(b.id);
            const isBorrowed = b.quantidade_disponivel === 0;
            const pending = pendingBooks.has(b.id);
            return (
              <Card key={b.id} className="overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                <div className="aspect-[2/3] bg-muted relative">
                  {b.capa_url ? (
                    <img src={b.capa_url} alt={b.titulo} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <BookOpen className="h-10 w-10" />
                    </div>
                  )}
                  <Badge variant={b.quantidade_disponivel > 0 ? "default" : "secondary"} className="absolute top-2 right-2">
                    {b.quantidade_disponivel > 0 ? "Disponível" : "Emprestado"}
                  </Badge>
                </div>
                <CardContent className="p-3 space-y-2 flex-1 flex flex-col">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm line-clamp-2">{b.titulo}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{b.autor}</p>
                    {b.categories?.nome && <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{b.categories.nome}</p>}
                  </div>
                  {user && (
                    <div className="pt-1">
                      {myLoanId ? (
                        <Button size="sm" variant="outline" className="w-full" onClick={() => handleReturn(myLoanId as string)}>
                          <RotateCcw className="h-3 w-3 mr-1" />Devolver
                        </Button>
                      ) : isStaff && isBorrowed && anyLoanId ? (
                        <Button size="sm" variant="outline" className="w-full" onClick={() => handleReturn(anyLoanId as string)}>
                          <RotateCcw className="h-3 w-3 mr-1" />Devolver
                        </Button>
                      ) : pending ? (
                        <Button size="sm" variant="secondary" className="w-full" disabled>Solicitado</Button>
                      ) : !isBorrowed ? (
                        <Button size="sm" className="w-full" onClick={() => handleRequest(b.id)}>
                          <Send className="h-3 w-3 mr-1" />Solicitar
                        </Button>
                      ) : null}
                      {isStaff && (
                        <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setEditing({ ...b, ano: b.ano ?? "", numero_paginas: b.numero_paginas ?? "", quantidade_total: b.quantidade_total ?? 1 })}>
                          <Pencil className="h-3 w-3 mr-1" />Editar dados
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center text-xs text-muted-foreground">
        {isFetchingNextPage ? "Carregando mais..." : hasNextPage ? "Role para carregar mais" : books.length > 0 ? "Fim do acervo" : ""}
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar livro</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2 space-y-1"><Label>Título</Label><Input value={editing.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} /></div>
              <div className="space-y-1"><Label>Autor</Label><Input value={editing.autor ?? ""} onChange={(e) => setEditing({ ...editing, autor: e.target.value })} /></div>
              <div className="space-y-1"><Label>ISBN</Label><Input value={editing.isbn ?? ""} onChange={(e) => setEditing({ ...editing, isbn: e.target.value })} /></div>
              <div className="space-y-1"><Label>Editora</Label><Input value={editing.editora ?? ""} onChange={(e) => setEditing({ ...editing, editora: e.target.value })} /></div>
              <div className="space-y-1"><Label>Ano</Label><Input type="number" value={editing.ano ?? ""} onChange={(e) => setEditing({ ...editing, ano: e.target.value })} /></div>
              <div className="space-y-1"><Label>Páginas</Label><Input type="number" value={editing.numero_paginas ?? ""} onChange={(e) => setEditing({ ...editing, numero_paginas: e.target.value })} /></div>
              <div className="space-y-1"><Label>Quantidade Total</Label><Input type="number" min={1} value={editing.quantidade_total ?? 1} onChange={(e) => setEditing({ ...editing, quantidade_total: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Select value={editing.categoria_id ?? "none"} onValueChange={(v) => setEditing({ ...editing, categoria_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— Nenhuma —</SelectItem>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Estante / Prateleira</Label>
                <Select value={editing.localizacao_prateleira ?? "none"} onValueChange={(v) => setEditing({ ...editing, localizacao_prateleira: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— Nenhuma —</SelectItem>{shelves.map((s: any) => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-1"><Label>Sinopse</Label><Textarea rows={4} value={editing.sinopse ?? ""} onChange={(e) => setEditing({ ...editing, sinopse: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={saveEditing}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return <>{content}</>;

}

function StatTile({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="h-7 w-7 text-primary" />
      </CardContent>
    </Card>
  );
}
