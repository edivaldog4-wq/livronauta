import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ScanBarcode, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createLoan } from "@/lib/loans.functions";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QuickLoanDialogProps { open: boolean; onOpenChange: (open: boolean) => void }

export function QuickLoanDialog({ open, onOpenChange }: QuickLoanDialogProps) {
  const qc = useQueryClient();
  const create = useServerFn(createLoan);
  const [bookId, setBookId] = useState("");
  const [userId, setUserId] = useState("");
  const [code, setCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [locatedBook, setLocatedBook] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: books = [] } = useQuery({
    queryKey: ["quick-loan-books"], enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("books").select("id, titulo, autor, isbn, capa_url, quantidade_disponivel").gt("quantidade_disponivel", 0).order("titulo");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"], enabled: open,
    queryFn: async () => (await supabase.from("profiles").select("id, nome, email, numero").order("nome")).data ?? [],
  });
  const selected = useMemo(() => locatedBook?.id === bookId ? locatedBook : books.find((book: any) => book.id === bookId), [books, bookId, locatedBook]);

  useEffect(() => { if (!open) { setBookId(""); setUserId(""); setCode(""); setLocatedBook(null); } }, [open]);

  const findCode = async (raw: string) => {
    const value = raw.trim();
    if (!value) return toast.error("Digite ou leia um código");
    setSearching(true);
    try {
      const { data: labels, error } = await supabase.from("labels").select("book_id").eq("codigo_barras", value).limit(1);
      if (error) throw error;
      const label = labels?.[0];
      let id = label?.book_id ?? "";
      if (!id) {
        const compact = value.replace(/[\s-]/g, "").toUpperCase();
        const match = books.find((book: any) => (book.isbn ?? "").replace(/[\s-]/g, "").toUpperCase() === compact);
        id = match?.id ?? "";
      }
      let book = books.find((item: any) => item.id === id);
      if (id && !book) {
        const { data: fetched, error: bookError } = await supabase.from("books").select("id, titulo, autor, isbn, capa_url, quantidade_disponivel").eq("id", id).gt("quantidade_disponivel", 0).maybeSingle();
        if (bookError) throw bookError;
        book = fetched ?? undefined;
      }
      if (!book) return toast.error("Nenhum livro disponível foi encontrado para esse código");
      setBookId(book.id);
      setLocatedBook(book);
      setCode(value);
      toast.success("Livro localizado");
    } catch (error: any) {
      toast.error(error.message || "Não foi possível pesquisar o código");
    } finally { setSearching(false); }
  };

  const submit = async () => {
    if (!bookId || !userId) return toast.error("Selecione o livro e o usuário");
    setSaving(true);
    try {
      await create({ data: { book_id: bookId, user_id: userId, dias: 14 } });
      ["loans", "available-books", "quick-loan-books", "books", "books-admin", "dashboard-stats", "loan-history"].forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      toast.success("Empréstimo registrado");
      onOpenChange(false);
    } catch (error: any) { toast.error(error.message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Empréstimo rápido</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Etiqueta ou ISBN</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") findCode(code); }} placeholder="Leia ou digite o código" />
                <Button type="button" size="icon" variant="outline" onClick={() => findCode(code)} disabled={searching} title="Pesquisar código"><Search className="h-4 w-4" /></Button>
                <Button type="button" size="icon" onClick={() => setScannerOpen(true)} title="Abrir leitor"><ScanBarcode className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Livro disponível</Label>
              <Combobox value={bookId} onChange={(value) => { setBookId(value); setLocatedBook(null); }} placeholder="Selecione o livro" searchPlaceholder="Título, autor ou ISBN…" emptyText="Nenhum livro disponível" options={books.map((book: any) => ({ value: book.id, label: book.titulo, hint: `${book.autor ?? "Autor não informado"} · ${book.quantidade_disponivel} disp.`, keywords: book.isbn ?? "" }))} />
            </div>
            {selected && <div className="flex gap-3 border-l-4 border-primary bg-muted p-3 text-sm">{selected.capa_url && <img src={selected.capa_url} alt="" className="h-20 w-14 shrink-0 object-cover" />}<div><p className="font-semibold">{selected.titulo}</p><p className="text-muted-foreground">{selected.autor || "Autor não informado"}</p>{selected.isbn && <p className="font-mono text-xs text-muted-foreground">ISBN {selected.isbn}</p>}</div></div>}
            <div className="space-y-1">
              <Label>Usuário da biblioteca</Label>
              <Combobox value={userId} onChange={setUserId} placeholder="Selecione o usuário" searchPlaceholder="Nome, e-mail ou número…" emptyText="Nenhum usuário" options={profiles.map((profile: any) => ({ value: profile.id, label: profile.nome || profile.email, hint: profile.numero ? `Nº ${profile.numero}` : profile.email, keywords: `${profile.email ?? ""} ${profile.numero ?? ""}` }))} />
            </div>
            <p className="text-xs text-muted-foreground">Prazo inicial de 14 dias. A data pode ser ajustada na página Empréstimos.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={submit} disabled={saving}>{saving ? "Registrando…" : "Registrar empréstimo"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={(value) => { setScannerOpen(false); void findCode(value); }} />
    </>
  );
}