import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, ChevronRight, History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Auditoria — Biblioteca" }] }),
  component: AuditPage,
});

const PAGE_SIZE = 25;

const TABLE_LABELS: Record<string, string> = {
  books: "Livros",
  loans: "Empréstimos",
  loan_requests: "Solicitações",
  categories: "Categorias",
  shelves: "Estantes",
  settings: "Configurações",
  user_roles: "Papéis",
};

const OP_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "Criação", variant: "default" },
  UPDATE: { label: "Edição", variant: "secondary" },
  DELETE: { label: "Exclusão", variant: "destructive" },
};

function AuditPage() {
  const { isStaff } = useAuth();
  const [page, setPage] = useState(0);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [opFilter, setOpFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["audit-log", page, tableFilter, opFilter, search],
    enabled: isStaff,
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (opFilter !== "all") q = q.eq("operation", opFilter);
      if (search.trim()) q = q.or(`summary.ilike.%${search}%,actor_email.ilike.%${search}%`);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (!isStaff) {
    return (
      <div className="container mx-auto p-6">
        <Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito à equipe.</CardContent></Card>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2"><History className="h-6 w-6" />Auditoria</h1>
        <p className="text-muted-foreground text-sm">Log completo de alterações no sistema para fins de auditoria.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou usuário…"
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <div className="w-48">
              <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as áreas</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Select value={opFilter} onValueChange={(v) => { setOpFilter(v); setPage(0); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="INSERT">Criação</SelectItem>
                  <SelectItem value="UPDATE">Edição</SelectItem>
                  <SelectItem value="DELETE">Exclusão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {isFetching ? "Carregando…" : "Nenhum registro"}
                </TableCell></TableRow>
              ) : rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>
                    <Badge variant={OP_LABELS[r.operation]?.variant ?? "outline"}>{OP_LABELS[r.operation]?.label ?? r.operation}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{TABLE_LABELS[r.table_name] ?? r.table_name}</TableCell>
                  <TableCell className="text-sm">{r.summary ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.actor_email ?? "sistema"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-4 text-sm">
            <span className="text-muted-foreground">
              Página {page + 1} de {totalPages} · {total} registro(s)
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || isFetching}>
                <ChevronLeft className="h-4 w-4 mr-1" />Anterior
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages || isFetching}>
                Próxima<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
