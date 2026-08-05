import { supabase } from "@/integrations/supabase/client";

const CHUNK = 1000;

/**
 * PostgREST limita cada resposta a 1000 linhas. Para estatísticas do acervo
 * é obrigatório paginar, senão os totais param de crescer em 1000 registros.
 */
export async function fetchAllBooks<T = any>(columns: string): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from("books")
      .select(columns)
      .order("id")
      .range(from, from + CHUNK - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < CHUNK) break;
  }
  return all;
}
