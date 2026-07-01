import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Printer, FileDown, Plus, Trash2, QrCode as QrCodeIcon, Barcode as BarcodeIcon, Slash } from "lucide-react";
import { toast } from "sonner";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/labels")({
  head: () => ({ meta: [{ title: "Etiquetas — Biblioteca" }] }),
  component: LabelsPage,
});

interface Item { bookId: string; quantidade: number }
interface LabelData { codigo: string; book: any }

type CodeType = "barcode" | "qrcode" | "none";

interface PaperPreset {
  id: string;
  label: string;
  cols: number;
  rows: number;
  marginX: number; // mm
  marginY: number; // mm
  gapX?: number;
  gapY?: number;
}

const PAPER_PRESETS: PaperPreset[] = [
  { id: "a4-3x8",  label: "A4 · 3 × 8 (24 etiquetas)", cols: 3, rows: 8, marginX: 8, marginY: 10 },
  { id: "a4-2x7",  label: "A4 · 2 × 7 (14 etiquetas grandes)", cols: 2, rows: 7, marginX: 10, marginY: 12 },
  { id: "a4-4x10", label: "A4 · 4 × 10 (40 etiquetas pequenas)", cols: 4, rows: 10, marginX: 6, marginY: 10 },
  { id: "a4-5x13", label: "A4 · 5 × 13 (65 etiquetas mini)", cols: 5, rows: 13, marginX: 5, marginY: 8 },
  { id: "custom",  label: "Personalizado…", cols: 3, rows: 8, marginX: 8, marginY: 10 },
];

function LabelsPage() {
  const { isStaff } = useAuth();
  const [items, setItems] = useState<Item[]>([{ bookId: "", quantidade: 1 }]);
  const [startOffset, setStartOffset] = useState("0");
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [codeType, setCodeType] = useState<CodeType>("barcode");
  const [presetId, setPresetId] = useState<string>("a4-3x8");
  const [customCols, setCustomCols] = useState(3);
  const [customRows, setCustomRows] = useState(8);
  const [customMx, setCustomMx] = useState(8);
  const [customMy, setCustomMy] = useState(10);

  const { data: books = [] } = useQuery({
    queryKey: ["all-books-labels"],
    queryFn: async () => (await supabase.from("books").select("id, titulo, autor, isbn, localizacao_prateleira").order("titulo")).data ?? [],
  });

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  const addRow = () => setItems((x) => [...x, { bookId: "", quantidade: 1 }]);
  const removeRow = (i: number) => setItems((x) => x.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const preset = useMemo<PaperPreset>(() => {
    if (presetId === "custom") {
      return { id: "custom", label: "Personalizado", cols: customCols, rows: customRows, marginX: customMx, marginY: customMy };
    }
    return PAPER_PRESETS.find((p) => p.id === presetId) ?? PAPER_PRESETS[0];
  }, [presetId, customCols, customRows, customMx, customMy]);

  const renderCodes = () => {
    labels.forEach(async (l) => {
      if (codeType === "barcode") {
        const svg = document.getElementById(`bc-${l.codigo}`);
        if (svg) {
          JsBarcode(svg, l.codigo, {
            format: "CODE128",
            width: 1.8,
            height: 44,
            fontSize: 11,
            margin: 0,
            displayValue: true,
          });
        }
      } else if (codeType === "qrcode") {
        const canvas = document.getElementById(`qr-${l.codigo}`) as HTMLCanvasElement | null;
        if (canvas) {
          await QRCode.toCanvas(canvas, l.codigo, { errorCorrectionLevel: "M", margin: 0, width: 96 });
        }
      }
    });
  };

  useEffect(() => { if (labels.length) renderCodes(); /* eslint-disable-next-line */ }, [labels, codeType]);

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
  };

  const handlePrint = () => window.print();

  const handlePdf = async () => {
    if (labels.length === 0) return;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = 210, pageH = 297;
    const { cols, rows, marginX, marginY } = preset;
    const cellW = (pageW - marginX * 2) / cols;
    const cellH = (pageH - marginY * 2) / rows;
    const skip = parseInt(startOffset) || 0;

    for (let idx = 0; idx < labels.length; idx++) {
      const l = labels[idx];
      const globalIdx = idx + skip;
      const localIdx = globalIdx % (cols * rows);
      if (idx > 0 && localIdx === 0) pdf.addPage();
      const col = localIdx % cols;
      const row = Math.floor(localIdx / cols);
      const x = marginX + col * cellW;
      const y = marginY + row * cellH;

      pdf.setFontSize(8); pdf.setFont("helvetica", "bold");
      pdf.text(String(l.book.titulo).slice(0, 36), x + 2, y + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7);
      pdf.text(String(l.book.autor ?? "").slice(0, 36), x + 2, y + 8);

      const codeAreaTop = y + 10;
      const codeAreaH = cellH - 14;

      if (codeType === "barcode") {
        const canvas = document.createElement("canvas");
        JsBarcode(canvas, l.codigo, { format: "CODE128", width: 2, height: 60, fontSize: 12, margin: 0, displayValue: true });
        const img = canvas.toDataURL("image/png");
        pdf.addImage(img, "PNG", x + 2, codeAreaTop, cellW - 4, Math.min(codeAreaH - 4, 18));
      } else if (codeType === "qrcode") {
        const dataUrl = await QRCode.toDataURL(l.codigo, { errorCorrectionLevel: "M", margin: 0, width: 240 });
        const size = Math.min(cellW - 6, codeAreaH - 4, 20);
        pdf.addImage(dataUrl, "PNG", x + (cellW - size) / 2, codeAreaTop, size, size);
      }

      pdf.setFontSize(6);
      pdf.text(`Prateleira: ${l.book.localizacao_prateleira ?? "—"}`, x + 2, y + cellH - 2);
    }
    pdf.save(`etiquetas-${Date.now()}.pdf`);
  };

  const bookOptions = books.map((b: any) => ({
    value: b.id,
    label: b.titulo,
    hint: [b.autor, b.localizacao_prateleira ? `Est. ${b.localizacao_prateleira}` : null].filter(Boolean).join(" · "),
    keywords: `${b.autor ?? ""} ${b.isbn ?? ""} ${b.localizacao_prateleira ?? ""}`,
  }));

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="no-print">
        <h1 className="text-2xl md:text-3xl font-bold">Etiquetas</h1>
        <p className="text-muted-foreground text-sm">Gere etiquetas em lote — busque livros pelo nome e escolha o layout do papel</p>
      </div>

      <Card className="no-print">
        <CardContent className="pt-6 space-y-3">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-8 space-y-1">
                <Label className={idx > 0 ? "sr-only" : ""}>Livro</Label>
                <Combobox
                  value={it.bookId}
                  onChange={(v) => updateRow(idx, { bookId: v })}
                  placeholder="Selecione ou busque um livro"
                  searchPlaceholder="Buscar por título, autor, ISBN ou prateleira…"
                  emptyText="Nenhum livro encontrado"
                  options={bookOptions}
                />
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t">
            <div className="space-y-1">
              <Label>Código impresso</Label>
              <Select value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="barcode"><span className="inline-flex items-center gap-2"><BarcodeIcon className="h-4 w-4" />Código de barras</span></SelectItem>
                  <SelectItem value="qrcode"><span className="inline-flex items-center gap-2"><QrCodeIcon className="h-4 w-4" />QR Code</span></SelectItem>
                  <SelectItem value="none"><span className="inline-flex items-center gap-2"><Slash className="h-4 w-4" />Nenhum</span></SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Usado pelo leitor da página Empréstimos para localizar o livro.</p>
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Layout do papel</Label>
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAPER_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Adesivos por folha A4. Escolha “Personalizado” para outras marcas.</p>
            </div>

            <div className="space-y-1">
              <Label>Pular células iniciais</Label>
              <Input type="number" min={0} value={startOffset} onChange={(e) => setStartOffset(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Reaproveita folha já usada.</p>
            </div>

            {presetId === "custom" && (
              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md border p-3 bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-xs">Colunas</Label>
                  <Input type="number" min={1} max={10} value={customCols} onChange={(e) => setCustomCols(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Linhas</Label>
                  <Input type="number" min={1} max={20} value={customRows} onChange={(e) => setCustomRows(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Margem X (mm)</Label>
                  <Input type="number" min={0} value={customMx} onChange={(e) => setCustomMx(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Margem Y (mm)</Label>
                  <Input type="number" min={0} value={customMy} onChange={(e) => setCustomMy(Math.max(0, parseInt(e.target.value) || 0))} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap justify-end pt-2">
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
        <div className="bg-white p-4 rounded-lg border print:border-0 print:p-0">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${preset.cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: parseInt(startOffset) || 0 }).map((_, i) => (
              <div key={`empty-${i}`} className="border border-dashed border-gray-200 rounded p-2" style={{ minHeight: "100px" }} />
            ))}
            {labels.map((l) => (
              <div key={l.codigo} className="border border-dashed border-gray-300 rounded p-2 text-xs flex flex-col" style={{ minHeight: "100px" }}>
                <div className="font-semibold text-[11px] line-clamp-2 text-black">{l.book.titulo}</div>
                <div className="text-[10px] text-gray-700 line-clamp-1">{l.book.autor}</div>
                <div className="flex-1 flex items-center justify-center my-1">
                  {codeType === "barcode" && <svg id={`bc-${l.codigo}`} />}
                  {codeType === "qrcode" && <canvas id={`qr-${l.codigo}`} />}
                  {codeType === "none" && <span className="font-mono text-[10px] text-gray-500">{l.codigo}</span>}
                </div>
                <div className="text-[9px] text-gray-600 mt-auto">Prateleira: {l.book.localizacao_prateleira ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
