import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/labels")({
  head: () => ({ meta: [{ title: "Etiquetas — Biblioteca" }] }),
  component: LabelsPage,
});

interface Item { bookId: string; quantidade: number }
interface LabelData { codigo: string; book: any }

function LabelsPage() {
  const { isStaff } = useAuth();
  const [items, setItems] = useState<Item[]>([{ bookId: "", quantidade: 1 }]);
  const [startOffset, setStartOffset] = useState("0");
  const [labels, setLabels] = useState<LabelData[]>([]);

  const { data: books = [] } = useQuery({
    queryKey: ["all-books-labels"],
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, isbn, localizacao_prateleira").order("titulo")).data ?? [],
  });

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const addRow = () => setItems((x) => [...x, { bookId: "", quantidade: 1 }]);
  const removeRow = (i: number) => setItems((x) => x.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const generate = async () => {
    const valid = items.filter((i) => i.bookId && i.quantidade > 0);
    if (valid.length === 0) return toast.error("Adicione ao menos um livro");
    const total = valid.reduce((s, i) => s + i.quantidade, 0);
    if (total > 500) return toast.error("Máximo 500 etiquetas por vez");

    const out: LabelData[] = [];
    const rows: any[] = [];
    let seq = parseInt(startOffset) || 0;
    for (const it of valid) {
      const book = books.find((b: any) => b.id === it.bookId);
      if (!book) continue;
      const base = book.isbn?.replace(/[^0-9]/g, "") || book.id.slice(0, 8);
      for (let n = 1; n <= it.quantidade; n++) {
        seq += 1;
        const codigo = `${base}-${String(seq).padStart(4, "0")}`;
        out.push({ codigo, book });
        rows.push({ book_id: book.id, codigo_barras: codigo });
      }
    }
    await supabase.from("labels").upsert(rows, { onConflict: "codigo_barras", ignoreDuplicates: true });
    setLabels(out);
    toast.success(`${out.length} etiquetas geradas`);

    setTimeout(() => {
      out.forEach((l) => {
        const svg = document.getElementById(`bc-${l.codigo}`);
        if (svg) JsBarcode(svg, l.codigo, { format: "CODE128", width: 1.4, height: 36, fontSize: 10, margin: 0 });
      });
    }, 50);
  };

  const handlePrint = () => window.print();

  const handlePdf = () => {
    if (labels.length === 0) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, pageH = 297;
    const cols = 3, rows = 8;
    const marginX = 8, marginY = 10;
    const cellW = (pageW - marginX * 2) / cols;
    const cellH = (pageH - marginY * 2) / rows;

    labels.forEach((l, idx) => {
      const localIdx = idx % (cols * rows);
      if (localIdx === 0 && idx > 0) pdf.addPage();
      const col = localIdx % cols;
      const row = Math.floor(localIdx / cols);
      const x = marginX + col * cellW;
      const y = marginY + row * cellH;

      const canvas = document.createElement("canvas");
      JsBarcode(canvas, l.codigo, { format: "CODE128", width: 1.2, height: 30, fontSize: 8, margin: 0 });
      const img = canvas.toDataURL("image/png");

      pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.text(l.book.titulo.slice(0, 32), x + 2, y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      pdf.text((l.book.autor ?? "").slice(0, 32), x + 2, y + 8);
      pdf.addImage(img, "PNG", x + 2, y + 10, cellW - 4, 14);
      pdf.setFontSize(6);
      pdf.text(`Prateleira: ${l.book.localizacao_prateleira ?? "—"}`, x + 2, y + cellH - 2);
    });
    pdf.save(`etiquetas-${Date.now()}.pdf`);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="no-print">
        <h1 className="text-2xl md:text-3xl font-bold">Etiquetas</h1>
        <p className="text-muted-foreground text-sm">Gere etiquetas em lote para vários livros — otimiza o uso da folha A4</p>
      </div>

      <Card className="no-print">
        <CardContent className="pt-6 space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-8 space-y-1">
                <Label className={idx > 0 ? "sr-only" : ""}>Livro</Label>
                <Select value={it.bookId} onValueChange={(v) => updateRow(idx, { bookId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o livro" /></SelectTrigger>
                  <SelectContent>
                    {books.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-1">
                <Label className={idx > 0 ? "sr-only" : ""}>Quantidade</Label>
                <Input type="number" min={1} value={it.quantidade} onChange={(e) => updateRow(idx, { quantidade: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="md:col-span-1">
                <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} disabled={items.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Adicionar livro</Button>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end pt-2 border-t">
            <div className="space-y-1">
              <Label>Pular células iniciais</Label>
              <Input type="number" min={0} value={startOffset} onChange={(e) => setStartOffset(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Útil para reaproveitar folha já usada.</p>
            </div>
            <div className="md:col-span-3 flex gap-2 flex-wrap justify-end">
              <Button onClick={generate}>Gerar Etiquetas</Button>
              {labels.length > 0 && (
                <>
                  <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                  <Button variant="outline" onClick={handlePdf}><FileDown className="h-4 w-4 mr-2" />Exportar PDF</Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {labels.length > 0 && (
        <div className="bg-white p-4 rounded-lg border print:border-0 print:p-0">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: parseInt(startOffset) || 0 }).map((_, i) => (
              <div key={`empty-${i}`} className="border border-dashed border-gray-200 rounded p-2" style={{ minHeight: "90px" }} />
            ))}
            {labels.map((l) => (
              <div key={l.codigo} className="border border-dashed border-gray-300 rounded p-2 text-xs flex flex-col" style={{ minHeight: "90px" }}>
                <div className="font-semibold text-[11px] line-clamp-2 text-black">{l.book.titulo}</div>
                <div className="text-[10px] text-gray-700 line-clamp-1">{l.book.autor}</div>
                <svg id={`bc-${l.codigo}`} className="my-1" />
                <div className="text-[9px] text-gray-600 mt-auto">Prateleira: {l.book.localizacao_prateleira ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
