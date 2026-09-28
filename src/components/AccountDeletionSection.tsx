import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function AccountDeletionSection() {
  const qc = useQueryClient();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["account-deletion-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("account_deletion_status" as any);
      if (error) throw error;
      return data as any;
    },
  });
  const pending = data?.status === "pending";
  const request = async () => {
    if (confirmation !== "EXCLUIR MINHA CONTA") return toast.error("Digite a frase de confirmação completa");
    setBusy(true);
    const { error } = await supabase.rpc("request_account_deletion" as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    setConfirmation("");
    qc.invalidateQueries({ queryKey: ["account-deletion-status"] });
    toast.success("Exclusão agendada para daqui a 30 dias");
  };
  const cancel = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_account_deletion" as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["account-deletion-status"] });
    toast.success("Solicitação de exclusão cancelada");
  };
  return (
    <Card className="border-destructive/40">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base text-destructive"><AlertTriangle className="h-4 w-4" />Excluir conta</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {pending ? <>
          <p className="text-sm">Sua conta está agendada para exclusão definitiva em <strong>{new Date(data.scheduled_for).toLocaleDateString("pt-BR")}</strong>.</p>
          <p className="text-xs text-muted-foreground">Até essa data, você pode cancelar a solicitação e continuar usando o Livronauta normalmente.</p>
          <Button variant="outline" onClick={cancel} disabled={busy}>Cancelar exclusão</Button>
        </> : <>
          <p className="text-sm text-muted-foreground">A exclusão será processada após 30 dias. Faça um backup antes. Durante o prazo, você poderá cancelar.</p>
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite EXCLUIR MINHA CONTA" />
          <Button variant="destructive" onClick={request} disabled={busy || confirmation !== "EXCLUIR MINHA CONTA"}>Solicitar exclusão da conta</Button>
        </>}
      </CardContent>
    </Card>
  );
}