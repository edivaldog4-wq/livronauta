import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLibraryName() {
  const { data } = useQuery({
    queryKey: ["library-name"],
    queryFn: async () => {
      const { data } = await supabase.from("settings").select("value").eq("key", "library_name").maybeSingle();
      const v = data?.value as any;
      if (typeof v === "string") return v;
      if (v && typeof v === "object") return String(v);
      return "Minha Biblioteca";
    },
  });
  return data ?? "Minha Biblioteca";
}
