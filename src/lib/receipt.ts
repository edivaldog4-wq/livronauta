import jsPDF from "jspdf";
import JsBarcode from "jsbarcode";

export interface ReceiptData {
  libraryName: string;
  loanCode: string;
  bookTitle: string;
  bookAuthor?: string | null;
  bookIsbn?: string | null;
  memberName: string;
  memberNumber?: string | null;
  loanDate: Date;
  dueDate: Date;
  finePerDay: number;
}

export function generateReceiptPdf(d: ReceiptData) {
  // A6 = 105 x 148 mm
  const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const W = 105;
  let y = 8;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(d.libraryName, W / 2, y, { align: "center" });
  y += 5;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Comprovante de Empréstimo", W / 2, y, { align: "center" });
  y += 3;
  pdf.line(6, y, W - 6, y);
  y += 5;

  pdf.setFontSize(8);
  const line = (label: string, value: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(label, 6, y);
    pdf.setFont("helvetica", "normal");
    const text = pdf.splitTextToSize(value, W - 38);
    pdf.text(text, 38, y);
    y += Array.isArray(text) ? text.length * 4 : 4;
    y += 1;
  };

  line("Código:", d.loanCode);
  line("Livro:", d.bookTitle);
  if (d.bookAuthor) line("Autor:", d.bookAuthor);
  if (d.bookIsbn) line("ISBN:", d.bookIsbn);
  line("Mutuário:", d.memberName);
  if (d.memberNumber) line("Nº Perfil:", d.memberNumber);
  line("Empréstimo:", d.loanDate.toLocaleDateString("pt-BR"));
  line("Devolução até:", d.dueDate.toLocaleDateString("pt-BR"));
  line("Multa/dia atraso:", `R$ ${d.finePerDay.toFixed(2)}`);

  // Barcode
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, d.loanCode, { format: "CODE128", width: 1.2, height: 25, fontSize: 8, margin: 0 });
    const img = canvas.toDataURL("image/png");
    pdf.addImage(img, "PNG", 15, 148 - 32, 75, 16);
  } catch {}

  pdf.setFontSize(6);
  pdf.text("Apresente este comprovante na devolução.", W / 2, 148 - 6, { align: "center" });

  pdf.autoPrint();
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (!w) pdf.save(`comprovante-${d.loanCode}.pdf`);
}
