import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/catalog")({
  head: () => ({ meta: [{ title: "Catálogo — Biblioteca" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [availability, setAvailability] = useState<string>("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data ?? [];
    },
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

  const content = (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Catálogo</h1>
          <p className="text-muted-foreground text-sm">{books.length} {books.length === 1 ? "livro" : "livros"} no acervo</p>
        </div>
        {!user && (
          <Button asChild><Link to="/auth"><LogIn className="h-4 w-4 mr-2" />Entrar</Link></Button>
        )}
      </div>

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
            Biblioteca
          </Link>
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
        </div>
      </header>
      {content}
    </div>
  );
}
