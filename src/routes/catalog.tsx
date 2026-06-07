import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, LogIn, Library as LibIcon, CheckCircle2, Tags, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/AppLayout";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useLibraryName } from "@/lib/library";

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Catálogo — Biblioteca" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const { user } = useAuth();
  const libraryName = useLibraryName();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [availability, setAvailability] = useState<string>("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("nome")).data ?? [],
  });

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["books", search, categoryId, availability],
    queryFn: async () => {
      let q = supabase.from("books").select("*, categories(nome)").order("titulo");
      if (search.trim()) q = q.or(`titulo.ilike.%${search}%,autor.ilike.%${search}%,isbn.ilike.%${search}%`);
      if (categoryId !== "all") q = q.eq("categoria_id", categoryId);
      if (availability === "available") q = q.gt("quantidade_disponivel", 0);
      if (availability === "unavailable") q = q.eq("quantidade_disponivel", 0);
      const { data } = await q;
      return data ?? [];
    },
  });

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

  const content = (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{libraryName}</h1>
          <p className="text-muted-foreground text-sm">{books.length} {books.length === 1 ? "livro encontrado" : "livros encontrados"}</p>
        </div>
        {!user && (
          <Button asChild><Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Entrar</Link></Button>
        )}
      </div>

      {/* Estatísticas */}
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
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
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
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Carregando...</p>
      ) : books.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum livro encontrado.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map((b: any) => (
            <Card key={b.id} className="overflow-hidden hover:shadow-lg transition-shadow">
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
              <CardContent className="p-3 space-y-1">
                <h3 className="font-semibold text-sm line-clamp-2">{b.titulo}</h3>
                <p className="text-xs text-muted-foreground line-clamp-1">{b.autor}</p>
                {b.categories?.nome && <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{b.categories.nome}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return user ? <AppLayout title="Catálogo">{content}</AppLayout> : (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/catalog" className="flex items-center gap-2 font-semibold">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><BookOpen className="h-4 w-4" /></div>
            {libraryName}
          </Link>
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>
      {content}
    </div>
  );
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
