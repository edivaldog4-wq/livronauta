import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  loan: any | null;
  onClose: () => void;
  onConfirm: (payload: { observacao?: string; condicao?: string }) => Promise<void> | void;
}

export function ReturnLoanDialog({ open, loan, onClose, onConfirm }: Props) {
  const [condicao, setCondicao] = useState<string>("boa");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await onConfirm({ observacao: obs.trim() || undefined, condicao });
      setObs(""); setCondicao("boa");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar devolução</DialogTitle></DialogHeader>
        {loan && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3 bg-muted/40">
              <div><strong>Livro:</strong> {loan.books?.titulo ?? "—"}</div>
              <div><strong>Mutuário:</strong> {loan.profiles?.nome ?? loan.profiles?.email ?? "—"}</div>
              <div className="text-muted-foreground text-xs">Devolução prevista: {new Date(loan.data_devolucao_prevista).toLocaleDateString("pt-BR")}</div>
            </div>
            <div className="space-y-1">
              <Label>Condição do exemplar</Label>
              <Select value={condicao} onValueChange={setCondicao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="otima">Ótima</SelectItem>
                  <SelectItem value="boa">Boa</SelectItem>
                  <SelectItem value="razoavel">Razoável (desgaste)</SelectItem>
                  <SelectItem value="danificado">Danificado</SelectItem>
                  <SelectItem value="perdido">Perdido / não devolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Observações (opcional)</Label>
              <Textarea rows={3} placeholder="Anotações sobre a devolução, multa, danos, etc." value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Salvando..." : "Confirmar devolução"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
