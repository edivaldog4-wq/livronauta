import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, RotateCcw, BookOpenCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { requestLoan, returnLoan } from "@/lib/loans.functions";
import { ReturnLoanDialog } from "@/components/ReturnLoanDialog";

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
  const [reqOpen, setReqOpen] = useState(false);
  const [reqBookId, setReqBookId] = useState("");
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const reqLoan = useServerFn(requestLoan);
  const retLoan = useServerFn(returnLoan);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: myLoans = [] } = useQuery({
    queryKey: ["my-loans", user?.id],
    enabled: !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => (await supabase.from("loans").select("*, books(titulo, autor)").eq("user_id", user!.id).order("data_emprestimo", { ascending: false })).data ?? [],
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ["my-requests", user?.id],
    enabled: !!user,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => (await supabase.from("loan_requests").select("*, books(titulo, autor)").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: availableBooks = [] } = useQuery({
    queryKey: ["available-books"],
    enabled: reqOpen,
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, quantidade_disponivel").gt("quantidade_disponivel", 0).order("titulo")).data ?? [],
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["my-loans"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["all-books-stats"] });
    qc.invalidateQueries({ queryKey: ["available-books"] });
    qc.invalidateQueries({ queryKey: ["my-active-loans"] });
    qc.invalidateQueries({ queryKey: ["my-pending-requests"] });
    qc.invalidateQueries({ queryKey: ["pending-requests"] });
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["loans-global-history"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  };

  const submitRequest = async () => {
    if (!reqBookId) return toast.error("Selecione um livro");
    try {
      await reqLoan({ data: { book_id: reqBookId } });
      toast.success("Solicitação enviada! Aguarde aprovação da biblioteca.");
      setReqOpen(false); setReqBookId("");
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const confirmReturn = async (payload: { observacao?: string; condicao?: string }) => {
    if (!returnTarget) return;
    try {
      const r = await retLoan({ data: { loan_id: returnTarget.id, ...payload } });
      if (r.multa > 0) toast.warning(`Devolução registrada. Multa: R$ ${r.multa.toFixed(2)}`);
      else toast.success("Devolução registrada");
      setReturnTarget(null);
      invalidateAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const today = new Date().toISOString().slice(0, 10);
  const requestStatus: Record<string, { label: string; variant: any }> = {
    pendente: { label: "Pendente", variant: "default" },
    aprovado: { label: "Aprovado", variant: "secondary" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
    cancelado: { label: "Cancelado", variant: "outline" },
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus dados, solicite empréstimos e veja seu histórico</p>
        </div>
        {profile?.numero && (
          <div className="rounded-lg border bg-card px-4 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Número do Perfil</p>
            <p className="font-mono text-2xl font-bold tracking-widest">{profile.numero}</p>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold">Solicitar um empréstimo</p>
              <p className="text-sm text-muted-foreground">Escolha um livro disponível ou navegue pelo <Link to="/catalog" className="underline">catálogo</Link>.</p>
            </div>
          </div>
          <Button onClick={() => setReqOpen(true)}><Send className="h-4 w-4 mr-2" />Nova solicitação</Button>
        </CardContent>
      </Card>

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
          <h2 className="text-lg font-semibold mb-3">Minhas Solicitações</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Livro</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Decidido em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma solicitação</TableCell></TableRow>
                ) : myRequests.map((r: any) => {
                  const s = requestStatus[r.status] ?? { label: r.status, variant: "default" as const };
                  return (
                    <TableRow key={r.id}>
                      <TableCell>{r.books?.titulo ?? "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-sm">{r.decided_at ? new Date(r.decided_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myLoans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum empréstimo registrado</TableCell></TableRow>
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
                      <TableCell className="text-right">
                        {l.status === "ativo" && (
                          <Button size="sm" variant="outline" onClick={() => setReturnTarget(l)}>
                            <RotateCcw className="h-3 w-3 mr-1" />Devolver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar Empréstimo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Livro disponível</Label>
              <Select value={reqBookId} onValueChange={setReqBookId}>
                <SelectTrigger><SelectValue placeholder="Selecione o livro" /></SelectTrigger>
                <SelectContent>
                  {availableBooks.length === 0 ? (
                    <SelectItem disabled value="none">Nenhum livro disponível</SelectItem>
                  ) : availableBooks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.titulo} — {b.autor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Sua solicitação será revisada por um bibliotecário antes do empréstimo ser efetivado.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReqOpen(false)}>Cancelar</Button>
            <Button onClick={submitRequest}>Enviar solicitação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReturnLoanDialog open={!!returnTarget} loan={returnTarget} onClose={() => setReturnTarget(null)} onConfirm={confirmReturn} />
    </div>
  );
}
