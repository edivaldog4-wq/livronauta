import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, RefreshCw, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { bootstrapAdmin } from "@/lib/loans.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Biblioteca" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { isStaff, isAdmin, refreshRoles } = useAuth();
  const promote = useServerFn(bootstrapAdmin);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [books, loans, members, overdue, anyAdmin] = await Promise.all([
        supabase.from("books").select("quantidade_total,quantidade_disponivel"),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "ativo"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("loans").select("id", { count: "exact", head: true }).eq("status", "ativo").lt("data_devolucao_prevista", new Date().toISOString().slice(0, 10)),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
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

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
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
          O dashboard é exclusivo para Bibliotecários e Administradores.
        </CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <StatCard icon={BookOpen} label="Total de Livros" value={stats?.totalLivros ?? 0} color="text-blue-600" />
            <StatCard icon={RefreshCw} label="Empréstimos Ativos" value={stats?.emprestimosAtivos ?? 0} color="text-amber-600" />
            <StatCard icon={Users} label="Membros" value={stats?.membros ?? 0} color="text-emerald-600" />
            <StatCard icon={AlertTriangle} label="Atrasados" value={stats?.atrasados ?? 0} color="text-red-600" />
          </div>

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
