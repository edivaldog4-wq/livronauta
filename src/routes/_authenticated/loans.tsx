import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Plus, Printer, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { createLoan, returnLoan, updateLoanDueDate } from "@/lib/loans.functions";
import { useLibraryName } from "@/lib/library";
import { generateReceiptPdf } from "@/lib/receipt";
import { useRealtime } from "@/lib/use-realtime";
import { ReturnLoanDialog } from "@/components/ReturnLoanDialog";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Empréstimos — Biblioteca" }] }),
  component: LoansPage,
});

function LoansPage() {
  const { isStaff } = useAuth();
  const qc = useQueryClient();
  const libraryName = useLibraryName();
  const [open, setOpen] = useState(false);
  const [bookId, setBookId] = useState("");
  const [userId, setUserId] = useState("");
  const [receipt, setReceipt] = useState<any | null>(null);
  const [editLoan, setEditLoan] = useState<any | null>(null);
  const [editDate, setEditDate] = useState("");
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const create = useServerFn(createLoan);
  const ret = useServerFn(returnLoan);
  const updateDue = useServerFn(updateLoanDueDate);

  useRealtime(
    ["books"],
    [["loans"], ["available-books"], ["loans-global-history"], ["dashboard-stats"], ["pending-requests"], ["loan-history"], ["books-admin"], ["books"]],
  );

  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await supabase.from("loans")
        .select("*, books(titulo, autor, isbn), profiles!loans_user_id_profiles_fkey(nome, email, numero)")
        .order("data_emprestimo", { ascending: false });
      return data ?? [];
    },
  });

  const { data: books = [] } = useQuery({
    queryKey: ["available-books"],
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, isbn, quantidade_disponivel").gt("quantidade_disponivel", 0).order("titulo")).data ?? [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, nome, email, numero").order("nome")).data ?? [],
  });

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("settings").select("*")).data ?? [],
  });

  const finePerDay = (() => {
    const m = settings?.find((s: any) => s.key === "multa_por_dia");
    return m ? Number(m.value) || 0 : 0;
  })();

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["loans"] });
    qc.invalidateQueries({ queryKey: ["available-books"] });
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["books-admin"] });
    qc.invalidateQueries({ queryKey: ["loans-global-history"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["my-loans"] });
    qc.invalidateQueries({ queryKey: ["my-requests"] });
    qc.invalidateQueries({ queryKey: ["pending-requests"] });
    qc.invalidateQueries({ queryKey: ["loan-history"] });
  };

  const handleCreate = async () => {
    if (!bookId || !userId) return toast.error("Selecione livro e usuário");
    try {
      const r = await create({ data: { book_id: bookId, user_id: userId, dias: 14 } });
      toast.success("Empréstimo registrado");
      const book = books.find((b: any) => b.id === bookId);
      const profile = profiles.find((p: any) => p.id === userId);
      const due = new Date(); due.setDate(due.getDate() + 14);
      setReceipt({
        libraryName,
        loanCode: r.id.slice(0, 8).toUpperCase(),
        bookTitle: book?.titulo ?? "",
        bookAuthor: book?.autor,
        bookIsbn: book?.isbn,
        memberName: profile?.nome ?? profile?.email ?? "",
        memberNumber: profile?.numero,
        loanDate: new Date(),
        dueDate: due,
        finePerDay,
      });
      setOpen(false); setBookId(""); setUserId("");
      invalidateAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openReturn = (loan: any) => setReturnTarget(loan);

  const confirmReturn = async (payload: { observacao?: string; condicao?: string }) => {
    if (!returnTarget) return;
    try {
      const r = await ret({ data: { loan_id: returnTarget.id, ...payload } });
      if (r.multa > 0) toast.warning(`Devolução registrada. Multa: R$ ${r.multa.toFixed(2)}`);
      else toast.success("Devolução registrada");
      setReturnTarget(null);
      invalidateAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEditDate = (l: any) => {
    setEditLoan(l);
    setEditDate(l.data_devolucao_prevista);
  };

  const saveEditDate = async () => {
    if (!editLoan || !editDate) return;
    try {
      await updateDue({ data: { loan_id: editLoan.id, new_date: editDate } });
      toast.success("Data de devolução atualizada");
      setEditLoan(null);
      invalidateAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const reprintReceipt = (l: any) => {
    setReceipt({
      libraryName,
      loanCode: l.id.slice(0, 8).toUpperCase(),
      bookTitle: l.books?.titulo ?? "",
      bookAuthor: l.books?.autor,
      bookIsbn: l.books?.isbn,
      memberName: l.profiles?.nome ?? l.profiles?.email ?? "",
      memberNumber: l.profiles?.numero,
      loanDate: new Date(l.data_emprestimo),
      dueDate: new Date(l.data_devolucao_prevista),
      finePerDay,
    });
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
                <TableHead>Nº</TableHead>
                <TableHead>Emprestado em</TableHead>
                <TableHead>Devolução prevista</TableHead>
                <TableHead>Devolvido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Multa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum empréstimo registrado</TableCell></TableRow>
              ) : loans.map((l: any) => {
                const isOverdue = l.status === "ativo" && l.data_devolucao_prevista < today;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.books?.titulo}</TableCell>
                    <TableCell>{l.profiles?.nome || l.profiles?.email || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.profiles?.numero ?? "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_emprestimo).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_devolucao_prevista).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm">{l.data_devolucao_real ? new Date(l.data_devolucao_real).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      {l.status === "concluido" ? <Badge variant="secondary">Concluído</Badge>
                        : isOverdue ? <Badge variant="destructive">Atrasado</Badge>
                        : <Badge>Ativo</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{l.multa && Number(l.multa) > 0 ? `R$ ${Number(l.multa).toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => reprintReceipt(l)} title="Imprimir comprovante"><Printer className="h-3 w-3" /></Button>
                      {l.status === "ativo" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEditDate(l)} title="Editar data de devolução"><CalendarClock className="h-3 w-3" /></Button>
                          <Button size="sm" variant="outline" onClick={() => openReturn(l)}>Devolver</Button>
                        </>
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
              <Combobox
                value={bookId}
                onChange={setBookId}
                placeholder="Selecione o livro"
                searchPlaceholder="Buscar por título, autor ou ISBN…"
                emptyText="Nenhum livro disponível"
                options={books.map((b: any) => ({
                  value: b.id,
                  label: b.titulo,
                  hint: `${b.autor ?? ""} · ${b.quantidade_disponivel} disp.`,
                  keywords: `${b.autor ?? ""} ${b.isbn ?? ""}`,
                }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Membro</Label>
              <Combobox
                value={userId}
                onChange={setUserId}
                placeholder="Selecione o membro"
                searchPlaceholder="Buscar por nome, e-mail ou número…"
                emptyText="Nenhum membro"
                options={profiles.map((p: any) => ({
                  value: p.id,
                  label: p.nome || p.email,
                  hint: p.numero ? `Nº ${p.numero}` : p.email,
                  keywords: `${p.email ?? ""} ${p.numero ?? ""}`,
                }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">Devolução prevista: 14 dias a partir de hoje. Você poderá ajustar a data depois.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLoan} onOpenChange={(o) => !o && setEditLoan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar data de devolução</DialogTitle></DialogHeader>
          {editLoan && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <strong>Livro:</strong> {editLoan.books?.titulo}<br />
                <strong>Mutuário:</strong> {editLoan.profiles?.nome ?? editLoan.profiles?.email}
              </div>
              <div className="space-y-1">
                <Label>Nova data de devolução</Label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoan(null)}>Cancelar</Button>
            <Button onClick={saveEditDate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Comprovante de Empréstimo</DialogTitle></DialogHeader>
          {receipt && (
            <div className="space-y-2 text-sm">
              <div><strong>Biblioteca:</strong> {receipt.libraryName}</div>
              <div><strong>Código:</strong> <span className="font-mono">{receipt.loanCode}</span></div>
              <div><strong>Livro:</strong> {receipt.bookTitle}</div>
              <div><strong>Mutuário:</strong> {receipt.memberName} {receipt.memberNumber && <span className="text-muted-foreground">(Nº {receipt.memberNumber})</span>}</div>
              <div><strong>Devolução até:</strong> {receipt.dueDate.toLocaleDateString("pt-BR")}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceipt(null)}>Fechar</Button>
            <Button onClick={() => receipt && generateReceiptPdf(receipt)}>
              <Printer className="h-4 w-4 mr-2" />Imprimir A6
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReturnLoanDialog open={!!returnTarget} loan={returnTarget} onClose={() => setReturnTarget(null)} onConfirm={confirmReturn} />
    </div>
  );
}
