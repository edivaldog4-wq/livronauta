import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, FileDown } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/labels")({
  head: () => ({ meta: [{ title: "Etiquetas — Biblioteca" }] }),
  component: LabelsPage,
});

interface LabelData { codigo: string; book: any }

function LabelsPage() {
  const { isStaff } = useAuth();
  const [bookId, setBookId] = useState("");
  const [start, setStart] = useState("1");
  const [end, setEnd] = useState("10");
  const [labels, setLabels] = useState<LabelData[]>([]);
  const sheetRef = useRef<HTMLDivElement>(null);

  const { data: books = [] } = useQuery({
    queryKey: ["all-books"],
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, isbn, localizacao_prateleira").order("titulo")).data ?? [],
  });

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const generate = async () => {
    const book = books.find((b: any) => b.id === bookId);
    if (!book) return toast.error("Selecione um livro");
    const s = parseInt(start), e = parseInt(end);
    if (isNaN(s) || isNaN(e) || s < 1 || e < s) return toast.error("Faixa numérica inválida");
    if (e - s + 1 > 200) return toast.error("Máximo 200 etiquetas por vez");

    const base = book.isbn?.replace(/[^0-9]/g, "") || book.id.slice(0, 8);
    const newLabels: LabelData[] = [];
    const rows: any[] = [];
    for (let i = s; i <= e; i++) {
      const codigo = `${base}-${String(i).padStart(4, "0")}`;
      newLabels.push({ codigo, book });
      rows.push({ book_id: bookId, codigo_barras: codigo });
    }
    // upsert (ignore duplicates)
    await supabase.from("labels").upsert(rows, { onConflict: "codigo_barras", ignoreDuplicates: true });
    setLabels(newLabels);
    toast.success(`${newLabels.length} etiquetas geradas`);

    // render barcodes after DOM mounts
    setTimeout(() => {
      newLabels.forEach((l) => {
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
      const pageIdx = Math.floor(idx / (cols * rows));
      const localIdx = idx % (cols * rows);
      if (localIdx === 0 && idx > 0) pdf.addPage();
      const col = localIdx % cols;
      const row = Math.floor(localIdx / cols);
      const x = marginX + col * cellW;
      const y = marginY + row * cellH;

      // gerar barcode como dataURL via canvas
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
        <p className="text-muted-foreground text-sm">Gere etiquetas com código de barras para o acervo</p>
      </div>

      <Card className="no-print">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2 space-y-1">
            <Label>Livro</Label>
            <Select value={bookId} onValueChange={setBookId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {books.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.titulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Nº inicial</Label><Input type="number" min={1} value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-1"><Label>Nº final</Label><Input type="number" min={1} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          <div className="md:col-span-4 flex gap-2 flex-wrap">
            <Button onClick={generate}>Gerar Etiquetas</Button>
            {labels.length > 0 && (
              <>
                <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-2" />Imprimir</Button>
                <Button variant="outline" onClick={handlePdf}><FileDown className="h-4 w-4 mr-2" />Exportar PDF</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {labels.length > 0 && (
        <div ref={sheetRef} className="bg-white p-4 rounded-lg border print:border-0 print:p-0">
          <div className="grid grid-cols-3 gap-2" style={{ pageBreakInside: "avoid" }}>
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
