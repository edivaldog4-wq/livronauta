import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to postgres_changes on a set of tables; invalidate the given
 * query keys whenever any of them change.
 */
export function useRealtime(tables: string[], queryKeys: string[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`);
    tables.forEach((t) => {
      ch.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, () => {
        queryKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
