import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { createLoan, returnLoan } from "@/lib/loans.functions";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Empréstimos — Biblioteca" }] }),
  component: LoansPage,
});

function LoansPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState("");
  const [userId, setUserId] = useState("");
  const create = useServerFn(createLoan);
  const ret = useServerFn(returnLoan);

  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans")
        .select("*, books(titulo, autor), profiles(nome, email)")
        .order("data_emprestimo", { ascending: false });
      return data ?? [];
    },
  });

  const { data: books = [] } = useQuery({
    queryKey: ["available-books"],
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, quantidade_disponivel").gt("quantidade_disponivel", 0).order("titulo")).data ?? [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome, email").order("nome")).data ?? [],
  });

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const handleCreate = async () => {
    if (!bookId || !userId) return toast.error("Selecione livro e usuário");
    try {
      await create({ data: { book_id: bookId, user_id: userId, dias: 14 } });
      toast.success("Empréstimo registrado");
      setOpen(false); setBookId(""); setUserId("");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReturn = async (loanId: string) => {
    if (!confirm("Confirmar devolução?")) return;
    try {
      const r = await ret({ data: { loan_id: loanId } });
      if (r.multa > 0) toast.warning(`Devolução registrada. Multa: R$ ${r.multa.toFixed(2)}`);
      else toast.success("Devolução registrada");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Empréstimos</h1>
          <p className="text-muted-foreground text-sm">Controle de empréstimos e devoluções</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Empréstimo</Button>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Livro</TableHead>
                <TableHead>Membro</TableHead>
                <TableHead>Emprestado em</TableHead>
                <TableHead>Devolução prevista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Multa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum empréstimo registrado</TableCell></TableRow>
              ) : loans.map((l: any) => {
                const isOverdue = l.status === "ativo" && l.data_devolucao_prevista < today;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.books?.titulo}</TableCell>
                    <TableCell>{l.profiles?.nome || l.profiles?.email || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_emprestimo).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_devolucao_prevista).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {l.status === "concluido" ? <Badge variant="secondary">Concluído</Badge>
                        : isOverdue ? <Badge variant="destructive">Atrasado</Badge>
                        : <Badge>Ativo</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{l.multa && Number(l.multa) > 0 ? `R$ ${Number(l.multa).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      {l.status === "ativo" && (
                        <Button size="sm" variant="outline" onClick={() => handleReturn(l.id)}>Registrar Devolução</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Empréstimo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Livro disponível</Label>
              <Select value={bookId} onValueChange={setBookId}>
                <SelectTrigger><SelectValue placeholder="Selecione o livro" /></SelectTrigger>
                <SelectContent>
                  {books.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.titulo} — {b.autor} ({b.quantidade_disponivel} disp.)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Membro</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione o membro" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome || p.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Devolução prevista: 14 dias a partir de hoje.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
