import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Busca dados de um livro pelo ISBN ou código de barras na Open Library
export const fetchBookByIsbn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ isbn: z.string().trim().min(8).max(20) }))
  .handler(async ({ data }) => {
    const code = data.isbn.replace(/[^0-9Xx]/g, "");
    const candidates = [code];
    // Códigos EAN-13 de livros (978/979) são o próprio ISBN-13
    if (code.length === 13 && (code.startsWith("978") || code.startsWith("979"))) {
      // já é ISBN
    } else if (code.length === 12) {
      // tenta com '0' prefixado (UPC para ISBN-10 antigo)
      candidates.push("0" + code);
    }

    for (const isbn of candidates) {
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = (await res.json()) as Record<string, any>;
      const book = json[`ISBN:${isbn}`];
      if (!book) continue;
      return {
        found: true as const,
        titulo: book.title ?? "",
        autor: (book.authors ?? []).map((a: any) => a.name).join(", "),
        editora: (book.publishers ?? []).map((p: any) => p.name).join(", "),
        ano: book.publish_date ? parseInt(String(book.publish_date).match(/\d{4}/)?.[0] ?? "") || null : null,
        numero_paginas: book.number_of_pages ?? null,
        capa_url: book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null,
        sinopse: book.notes ?? book.description ?? null,
        idioma: null,
        isbn,
      };
    }
    return { found: false as const };
  });
