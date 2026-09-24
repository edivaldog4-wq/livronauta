import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Livronauta — Gestão de bibliotecas" },
      { name: "description", content: "Acesse o Livronauta para administrar seu acervo, empréstimos e usuários." },
      { property: "og:title", content: "Livronauta — Gestão de bibliotecas" },
      { property: "og:description", content: "Acesse o Livronauta para administrar seu acervo, empréstimos e usuários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
