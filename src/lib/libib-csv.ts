import Papa from "papaparse";

export const LIBIB_COLUMNS = [
  "item_type","title","creators","first_name","last_name","collection","ean_isbn13","upc_isbn10","description","publisher","publish_date","group","tags","notes","price","length","number_of_discs","number_of_players","age_group","ensemble","aspect_ratio","esrb","rating","review","review_date","status","began","completed","added","copies",
] as const;

export type LibibRow = Record<typeof LIBIB_COLUMNS[number], string>;

export function parseLibibCsv(text: string): LibibRow[] {
  const res = Papa.parse<LibibRow>(text, { header: true, skipEmptyLines: true });
  return (res.data ?? []).filter((r) => r.title);
}

export type LibibBookCandidate = {
  titulo: string;
  autor: string;
  isbn: string | null;
  editora: string | null;
  ano: number | null;
  numero_paginas: number | null;
  sinopse: string | null;
  quantidade_total: number;
  categoria_nome: string | null;
};

export function rowToBook(r: LibibRow): LibibBookCandidate {
  const autor = (r.creators || `${r.first_name || ""} ${r.last_name || ""}`).trim();
  const year = r.publish_date?.match(/\d{4}/)?.[0];
  return {
    titulo: r.title.trim(),
    autor,
    isbn: (r.ean_isbn13 || r.upc_isbn10 || "").trim() || null,
    editora: r.publisher?.trim() || null,
    ano: year ? parseInt(year) : null,
    numero_paginas: r.length ? parseInt(r.length) || null : null,
    sinopse: r.description?.trim() || null,
    quantidade_total: Math.max(1, parseInt(r.copies || "1") || 1),
    categoria_nome: r.collection?.trim() || null,
  };
}

export function booksToLibibCsv(books: any[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const rows = books.map((b) => {
    const row: any = {};
    LIBIB_COLUMNS.forEach((c) => (row[c] = ""));
    row.item_type = "book";
    row.title = b.titulo ?? "";
    row.creators = b.autor ?? "";
    if (b.autor) {
      const parts = String(b.autor).split(" ");
      row.first_name = parts[0] ?? "";
      row.last_name = parts.slice(1).join(" ");
    }
    row.collection = b.categories?.nome ?? "";
    if (b.isbn) {
      const clean = String(b.isbn).replace(/\D/g, "");
      if (clean.length === 13) row.ean_isbn13 = clean;
      else if (clean.length === 10) row.upc_isbn10 = clean;
      else row.ean_isbn13 = clean;
    }
    row.description = b.sinopse ?? "";
    row.publisher = b.editora ?? "";
    row.publish_date = b.ano ? `${b.ano}-01-01` : "";
    row.length = b.numero_paginas ?? "";
    row.status = "";
    row.added = (b.created_at ?? today).slice(0, 10);
    row.copies = b.quantidade_total ?? 1;
    return row;
  });
  return Papa.unparse(rows, { columns: LIBIB_COLUMNS as unknown as string[] });
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
