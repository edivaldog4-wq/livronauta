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

export interface LibraryUsage {
  books: number;
  limit: number;
  plan: "free" | "pro" | "unlimited";
  status: string | null;
  nome: string;
  invite_code: string | null;
}

export function useLibraryUsage() {
  return useQuery({
    queryKey: ["library-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("library_usage" as any);
      if (error) throw error;
      return (data ?? null) as LibraryUsage | null;
    },
  });
}

export function useMyLibraries() {
  return useQuery({
    queryKey: ["my-libraries"],
    queryFn: async () => {
      const [{ data: libs }, { data: auth }] = await Promise.all([
        supabase.from("libraries" as any).select("id, nome, plan").order("created_at"),
        supabase.auth.getUser(),
      ]);
      let active: string | null = null;
      if (auth.user) {
        const { data: p } = await supabase.from("profiles").select("active_library_id").eq("id", auth.user.id).maybeSingle();
        active = (p as any)?.active_library_id ?? null;
      }
      return { libraries: (libs ?? []) as unknown as { id: string; nome: string; plan: string }[], active };
    },
  });
}

export async function switchLibrary(id: string) {
  const { error } = await supabase.rpc("set_active_library" as any, { _library_id: id });
  if (error) throw error;
  window.location.href = "/dashboard";
}
