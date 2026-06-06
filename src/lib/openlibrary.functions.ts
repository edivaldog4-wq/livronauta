import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Busca dados de um livro pelo ISBN na Open Library
export const fetchBookByIsbn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ isbn: z.string().trim().min(8).max(20) }))
  .handler(async ({ data }) => {
    const isbn = data.isbn.replace(/[^0-9Xx]/g, "");
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
    const res = await fetch(url);
    if (!res.ok) return { found: false as const };
    const json = (await res.json()) as Record<string, any>;
    const book = json[`ISBN:${isbn}`];
    if (!book) return { found: false as const };
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
  });
