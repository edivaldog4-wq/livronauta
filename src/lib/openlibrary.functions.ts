import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type BookResult = {
  found: true;
  source: "openlibrary" | "googlebooks";
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
      ano: book.publish_date ? parseInt(String(book.publish_date).match(/\d{4}/)?.[0] ?? "") || null : null,
      numero_paginas: book.number_of_pages ?? null,
      capa_url: book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null,
      sinopse: typeof book.notes === "string" ? book.notes : (typeof book.description === "string" ? book.description : null),
      idioma: null,
      isbn,
    };
  } catch {
    return null;
  }
}

async function tryGoogleBooks(isbn: string): Promise<BookResult | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const item = json.items?.[0];
    if (!item) return null;
    const v = item.volumeInfo ?? {};
    return {
      found: true,
      source: "googlebooks",
      titulo: v.title ?? "",
      autor: (v.authors ?? []).join(", "),
      editora: v.publisher ?? "",
      ano: v.publishedDate ? parseInt(String(v.publishedDate).match(/\d{4}/)?.[0] ?? "") || null : null,
      numero_paginas: v.pageCount ?? null,
      capa_url: (v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? "").replace(/^http:/, "https:") || null,
      sinopse: v.description ?? null,
      idioma: v.language ?? null,
      isbn,
    };
  } catch {
    return null;
  }
}

export const fetchBookByIsbn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ isbn: z.string().trim().min(8).max(20) }))
  .handler(async ({ data }) => {
    const code = data.isbn.replace(/[^0-9Xx]/g, "");
    const candidates = [code];
    if (code.length === 12) candidates.push("0" + code);

    for (const isbn of candidates) {
      const fromOL = await tryOpenLibrary(isbn);
      if (fromOL) return fromOL;
      const fromGB = await tryGoogleBooks(isbn);
      if (fromGB) return fromGB;
    }
    return { found: false as const };
  });
