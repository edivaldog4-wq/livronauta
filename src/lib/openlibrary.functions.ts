import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type BookResult = {
  found: true;
  source: "brasilapi" | "openlibrary" | "googlebooks" | "openlibrary-search";
  titulo: string;
  autor: string;
  editora: string;
  ano: number | null;
  numero_paginas: number | null;
  capa_url: string | null;
  sinopse: string | null;
  idioma: string | null;
  isbn: string;
};

const digits = (s: string) => s.replace(/[^0-9Xx]/g, "").toUpperCase();

function isbn10to13(isbn10: string): string | null {
  if (isbn10.length !== 10) return null;
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += (i % 2 === 0 ? 1 : 3) * Number(core[i]);
  const check = (10 - (sum % 10)) % 10;
  return core + String(check);
}

function isbn13to10(isbn13: string): string | null {
  if (isbn13.length !== 13 || !isbn13.startsWith("978")) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const rest = (11 - (sum % 11)) % 11;
  return core + (rest === 10 ? "X" : String(rest));
}

const year = (v: unknown) =>
  v ? parseInt(String(v).match(/\d{4}/)?.[0] ?? "") || null : null;

/** BrasilAPI — agrega CBL / Mercado Editorial / Google Books (ótimo para livros brasileiros) */
async function tryBrasilApi(isbn: string): Promise<BookResult | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
    if (!res.ok) return null;
    const b = (await res.json()) as any;
    if (!b?.title) return null;
    return {
      found: true,
      source: "brasilapi",
      titulo: b.title ?? "",
      autor: (b.authors ?? []).join(", "),
      editora: b.publisher ?? "",
      ano: year(b.year),
      numero_paginas: b.page_count ?? null,
      capa_url: b.cover_url ?? null,
      sinopse: b.synopsis ?? null,
      idioma: b.language ?? null,
      isbn,
    };
  } catch {
    return null;
  }
}

async function tryOpenLibrary(isbn: string): Promise<BookResult | null> {
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, any>;
    const book = json[`ISBN:${isbn}`];
    if (!book) return null;
    return {
      found: true,
      source: "openlibrary",
      titulo: book.title ?? "",
      autor: (book.authors ?? []).map((a: any) => a.name).join(", "),
      editora: (book.publishers ?? []).map((p: any) => p.name).join(", "),
      ano: year(book.publish_date),
      numero_paginas: book.number_of_pages ?? null,
      capa_url: book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null,
      sinopse:
        typeof book.notes === "string"
          ? book.notes
          : typeof book.description === "string"
            ? book.description
            : null,
      idioma: null,
      isbn,
    };
  } catch {
    return null;
  }
}

async function tryGoogleBooks(isbn: string): Promise<BookResult | null> {
  for (const q of [`isbn:${isbn}`, isbn]) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&country=BR&maxResults=5`,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as any;
      const item = (json.items ?? [])[0];
      if (!item) continue;
      const v = item.volumeInfo ?? {};
      if (!v.title) continue;
      return {
        found: true,
        source: "googlebooks",
        titulo: v.title + (v.subtitle ? `: ${v.subtitle}` : ""),
        autor: (v.authors ?? []).join(", "),
        editora: v.publisher ?? "",
        ano: year(v.publishedDate),
        numero_paginas: v.pageCount ?? null,
        capa_url:
          (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "").replace(
            /^http:/,
            "https:",
          ) || null,
        sinopse: v.description ?? null,
        idioma: v.language ?? null,
        isbn,
      };
    } catch {
      /* próxima query */
    }
  }
  return null;
}

/** Busca textual do Open Library (pega edições que a API de bibkeys não resolve) */
async function tryOpenLibrarySearch(isbn: string): Promise<BookResult | null> {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,publisher,first_publish_year,number_of_pages_median,cover_i,language&limit=1`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const d = json.docs?.[0];
    if (!d?.title) return null;
    return {
      found: true,
      source: "openlibrary-search",
      titulo: d.title,
      autor: (d.author_name ?? []).join(", "),
      editora: (d.publisher ?? [])[0] ?? "",
      ano: d.first_publish_year ?? null,
      numero_paginas: d.number_of_pages_median ?? null,
      capa_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      sinopse: null,
      idioma: (d.language ?? [])[0] ?? null,
      isbn,
    };
  } catch {
    return null;
  }
}

export const fetchBookByIsbn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ isbn: z.string().trim().min(8).max(20) }))
  .handler(async ({ data }) => {
    const code = digits(data.isbn);
    const candidates = new Set<string>([code]);
    if (code.length === 12) candidates.add("0" + code);
    if (code.length === 13) {
      const c10 = isbn13to10(code);
      if (c10) candidates.add(c10);
    }
    if (code.length === 10) {
      const c13 = isbn10to13(code);
      if (c13) candidates.add(c13);
    }

    const sources = [tryBrasilApi, tryGoogleBooks, tryOpenLibrary, tryOpenLibrarySearch];
    for (const isbn of candidates) {
      for (const source of sources) {
        const r = await source(isbn);
        if (r) return { ...r, isbn: code };
      }
    }
    return { found: false as const };
  });
