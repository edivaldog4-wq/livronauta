import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, RefreshCw, Users, AlertTriangle, Check, X, Inbox, History, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { approveLoanRequest, bootstrapAdmin, rejectLoanRequest } from "@/lib/loans.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useLibraryName } from "@/lib/library";
import { useRealtime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Biblioteca" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isStaff, isAdmin, refreshRoles } = useAuth();
  const qc = useQueryClient();
  const promote = useServerFn(bootstrapAdmin);
  const approve = useServerFn(approveLoanRequest);
  const reject = useServerFn(rejectLoanRequest);
  const libraryName = useLibraryName();
  useRealtime(
    ["books"],
    [["dashboard-stats"], ["loan-history"], ["loans-global-history"], ["pending-requests"], ["audit-recent"]],
  );

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [books, loans, members, overdue, anyAdmin] = await Promise.all([
        supabase.from("books").select("quantidade_total,quantidade_disponivel"),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "ativo").lt("data_devolucao_prevista", new Date().toISOString().slice(0, 10)),
        supabase.rpc("admin_exists"),
      ]);

      const total = (books.data ?? []).reduce((a, b) => a + (b.quantidade_total ?? 0), 0);
      const disponiveis = (books.data ?? []).reduce((a, b) => a + (b.quantidade_disponivel ?? 0), 0);
      return {
        totalLivros: total,
        emprestados: total - disponiveis,
        emprestimosAtivos: loans.count ?? 0,
        membros: members.count ?? 0,
        atrasados: overdue.count ?? 0,
        hasAdmin: (anyAdmin.count ?? 0) > 0,
      };
    },
  });

  const { data: loanHistory = [] } = useQuery({
    queryKey: ["loan-history"],
    refetchOnMount: "always",
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const { data } = await supabase.from("loans").select("data_emprestimo").gte("data_emprestimo", since.toISOString());
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i * 4);
        const k = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        buckets[k] = 0;
      }
      (data ?? []).forEach((l: any) => {
        const k = new Date(l.data_emprestimo).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        if (k in buckets) buckets[k]++;
      });
      return Object.entries(buckets).map(([dia, total]) => ({ dia, total }));
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["loans-global-history"],
    enabled: isStaff,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("loans")
        .select("*, books(titulo), profiles(nome, numero)")
        .order("data_emprestimo", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["pending-requests"],
    enabled: isStaff,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase.from("loan_requests")
        .select("*, books(titulo, autor), profiles(nome, email, numero)")
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: recentAudit = [] } = useQuery({
    queryKey: ["audit-recent"],
    enabled: isStaff,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase.from("audit_log")
        .select("id, created_at, actor_email, table_name, operation, summary")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const handleBootstrap = async () => {
    const r = await promote();
    if (r.promoted) {
      toast.success("Você agora é Administrador!");
      await refreshRoles();
      window.location.reload();
    } else {
      toast.error("Já existe um administrador.");
    }
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["pending-requests"] });
    qc.invalidateQueries({ queryKey: ["loans-global-history"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["books-admin"] });
    qc.invalidateQueries({ queryKey: ["my-loans"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["loan-history"] });
  };

  const handleApprove = async (id: string) => {
    try {
      await approve({ data: { request_id: id, dias: 14 } });
      toast.success("Solicitação aprovada");
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleReject = async (id: string) => {
    if (!confirm("Recusar esta solicitação?")) return;
    try {
      await reject({ data: { request_id: id } });
      toast.success("Solicitação recusada");
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{libraryName}</h1>
        <p className="text-muted-foreground text-sm">Visão geral da biblioteca</p>
      </div>

      {stats && !stats.hasAdmin && !isAdmin && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold">Nenhum administrador definido</p>
              <p className="text-sm text-muted-foreground">Como você é o primeiro usuário, pode se promover a Administrador.</p>
            </div>
            <Button onClick={handleBootstrap}>Tornar-me Administrador</Button>
          </CardContent>
        </Card>
      )}

      {!isStaff ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          O dashboard administrativo é exclusivo para Bibliotecários e Administradores. Acesse <a href="/profile" className="underline">Meu Perfil</a> para solicitar empréstimos.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={BookOpen} label="Total de Livros" value={stats?.totalLivros ?? 0} color="text-primary" />
            <StatCard icon={RefreshCw} label="Empréstimos Ativos" value={stats?.emprestimosAtivos ?? 0} color="text-accent-foreground" />
            <StatCard icon={Users} label="Membros" value={stats?.membros ?? 0} color="text-secondary" />
            <StatCard icon={AlertTriangle} label="Atrasados" value={stats?.atrasados ?? 0} color="text-destructive" />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" />Solicitações Pendentes</CardTitle>
              <Badge variant={pendingRequests.length > 0 ? "default" : "secondary"}>{pendingRequests.length}</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma solicitação pendente.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Livro</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Nº</TableHead>
                      <TableHead>Solicitado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.books?.titulo ?? "—"}<br /><span className="text-xs text-muted-foreground">{r.books?.autor}</span></TableCell>
                        <TableCell>{r.profiles?.nome ?? r.profiles?.email ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.profiles?.numero ?? "—"}</TableCell>
                        <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button size="sm" onClick={() => handleApprove(r.id)}><Check className="h-3 w-3 mr-1" />Aprovar</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReject(r.id)}><X className="h-3 w-3 mr-1" />Recusar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" />Últimas modificações</CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link to="/audit">Ver auditoria completa<ArrowRight className="h-3 w-3 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Sem registros ainda.</p>
              ) : (
                <ul className="divide-y">
                  {recentAudit.map((a: any) => (
                    <li key={a.id} className="py-2 flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.summary ?? `${a.operation} em ${a.table_name}`}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.actor_email ?? "sistema"} · {new Date(a.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <Badge variant={a.operation === "DELETE" ? "destructive" : a.operation === "UPDATE" ? "secondary" : "default"}>
                        {a.operation === "INSERT" ? "Criação" : a.operation === "UPDATE" ? "Edição" : "Exclusão"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Empréstimos nos últimos 30 dias</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={loanHistory}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="dia" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Histórico de Empréstimos</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Livro</TableHead>
                    <TableHead>Mutuário</TableHead>
                    <TableHead>Nº</TableHead>
                    <TableHead>Emprestado</TableHead>
                    <TableHead>Devolução prevista</TableHead>
                    <TableHead>Devolvido</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Multa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Sem registros</TableCell></TableRow>
                  ) : history.map((l: any) => {
                    const overdue = l.status === "ativo" && l.data_devolucao_prevista < today;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.books?.titulo ?? "—"}</TableCell>
                        <TableCell>{l.profiles?.nome ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{l.profiles?.numero ?? "—"}</TableCell>
                        <TableCell className="text-sm">{new Date(l.data_emprestimo).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{new Date(l.data_devolucao_prevista).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-sm">{l.data_devolucao_real ? new Date(l.data_devolucao_real).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          {l.status === "concluido" ? <Badge variant="secondary">Concluído</Badge>
                            : overdue ? <Badge variant="destructive">Atrasado</Badge>
                            : <Badge>Ativo</Badge>}
                        </TableCell>
                        <TableCell className="text-sm">{Number(l.multa ?? 0) > 0 ? `R$ ${Number(l.multa).toFixed(2)}` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ${color ?? "text-primary"}`} />
      </CardContent>
    </Card>
  );
}
