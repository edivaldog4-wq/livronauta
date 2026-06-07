import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Meu Perfil — Biblioteca" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: myLoans = [] } = useQuery({
    queryKey: ["my-loans", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("loans").select("*, books(titulo, autor)").eq("user_id", user!.id).order("data_emprestimo", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(profile.telefone ?? "");
      setEndereco(profile.endereco ?? "");
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ nome, telefone: telefone || null, endereco: endereco || null }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus dados e veja seu histórico</p>
        </div>
        {profile?.numero && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Número do Perfil</p>
            <p className="font-mono text-2xl font-bold tracking-widest">{profile.numero}</p>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="space-y-1"><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div className="space-y-1"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Endereço</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} /></div>
          <div className="md:col-span-2"><Button onClick={save}>Salvar alterações</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-3">Histórico de Empréstimos</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livro</TableHead>
                  <TableHead>Emprestado</TableHead>
                  <TableHead>Devolução prevista</TableHead>
                  <TableHead>Devolvido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Multa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myLoans.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum empréstimo registrado</TableCell></TableRow>
                ) : myLoans.map((l: any) => {
                  const overdue = l.status === "ativo" && l.data_devolucao_prevista < today;
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.books?.titulo}</TableCell>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
