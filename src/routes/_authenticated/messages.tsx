import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Mensagens de contato — Livronauta" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["contact-messages"],
    queryFn: async () => (await supabase.from("contact_messages").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const remove = async (id: string) => {
    if (!confirm("Excluir esta mensagem?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["contact-messages"] });
  };
  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-bold md:text-3xl">Mensagens de contato</h1>
      {data.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma mensagem.</CardContent></Card>}
      {data.map((m: any) => (
        <Card key={m.id}><CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{m.nome}</div>
              <a className="text-sm underline" href={`mailto:${m.email}`}>{m.email}</a>
              <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
          <p className="whitespace-pre-wrap text-sm">{m.mensagem}</p>
        </CardContent></Card>
      ))}
    </div>
  );
}
