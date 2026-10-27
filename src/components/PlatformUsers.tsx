import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Gift, Shield, Search, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPlatformUsers, sendUserPasswordReset, changePlatformUserEmail, setPlatformUserRole, setComplimentaryAccess } from "@/lib/platform-admin.functions";

type PlatformUser = Awaited<ReturnType<typeof listPlatformUsers>>[number];
type Action = { kind: "reset" | "email" | "role" | "free"; user: PlatformUser; libraryId?: string; enabled?: boolean };

export function PlatformUsers() {
  const list = useServerFn(listPlatformUsers);
  const reset = useServerFn(sendUserPasswordReset);
  const emailChange = useServerFn(changePlatformUserEmail);
  const roleChange = useServerFn(setPlatformUserRole);
  const freeChange = useServerFn(setComplimentaryAccess);
  const qc = useQueryClient();
  const { data: users = [], isPending, error } = useQuery({ queryKey: ["platform-users"], queryFn: () => list() });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [role, setRole] = useState<"admin" | "bibliotecario" | "membro">("admin");
  const [busy, setBusy] = useState(false);
  const open = (next: Action) => { setAction(next); setEmail(next.user.email); setReason(""); setRole("admin"); };
  const submit = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action.kind === "reset") await reset({ data: { userId: action.user.id } });
      if (action.kind === "email") await emailChange({ data: { userId: action.user.id, email } });
      if (action.kind === "role" && action.libraryId) await roleChange({ data: { userId: action.user.id, libraryId: action.libraryId, role } });
      if (action.kind === "free" && action.libraryId) await freeChange({ data: { libraryId: action.libraryId, enabled: action.enabled === true, reason } });
      toast.success(action.kind === "reset" ? "E-mail de recuperação enviado" : "Alteração realizada");
      setAction(null);
      await qc.invalidateQueries({ queryKey: ["platform-users"] });
      await qc.invalidateQueries({ queryKey: ["library-usage"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Não foi possível concluir"); }
    finally { setBusy(false); }
  };
  return (
    <section className="space-y-4 border-t border-border pt-6" aria-label="Administração da plataforma">
      <div className="flex flex-wrap items-center gap-2"><Shield className="size-5 text-primary" /><h2 className="text-xl font-semibold">Administração da plataforma</h2><Badge variant="secondary">Fundador</Badge></div>
      <div className="relative max-w-md"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar contas da plataforma" placeholder="Buscar conta por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
      {isPending && <p className="text-muted-foreground">Carregando contas…</p>}
      {error && <p className="text-destructive">Não foi possível carregar as contas: {error.message}</p>}
      <div className="divide-y divide-border">
        {users.filter((user) => `${user.nome} ${user.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map((user) => (
          <article key={user.id} className="space-y-3 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <div className="min-w-0"><h3 className="font-semibold">{user.nome || "Sem nome"}</h3><p className="break-all text-sm text-muted-foreground">{user.email}</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => open({ kind: "reset", user })}><KeyRound className="size-4" />Recuperar senha</Button><Button variant="outline" size="icon" title="Trocar e-mail" aria-label={`Trocar e-mail de ${user.nome || user.email}`} onClick={() => open({ kind: "email", user })}><Mail className="size-4" /></Button></div>
            </div>
            {user.memberships.map((membership: any) => membership.library && (
              <div key={`${membership.library_id}-${membership.role}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{membership.library.nome}</span><Badge variant="outline">{membership.role}</Badge><Badge variant="secondary">{membership.library.complimentary_access ? "Gratuidade concedida" : membership.library.plan === "unlimited" ? "Ilimitado institucional" : membership.library.subscription_status ?? membership.library.plan}</Badge>
                <Button size="sm" variant="ghost" onClick={() => open({ kind: "role", user, libraryId: membership.library_id })}><Shield className="size-4" />Permissões</Button>
                {membership.library.owner_id === user.id && membership.library.plan !== "unlimited" && <Button size="sm" variant="ghost" onClick={() => open({ kind: "free", user, libraryId: membership.library_id, enabled: !membership.library.complimentary_access })}><Gift className="size-4" />{membership.library.complimentary_access ? "Revogar gratuidade" : "Conceder gratuidade"}</Button>}
              </div>
            ))}
          </article>
        ))}
      </div>
      <Dialog open={action !== null} onOpenChange={(value) => { if (!value && !busy) setAction(null); }}>
        <DialogContent className="max-w-md"><DialogHeader><DialogTitle>{action?.kind === "reset" ? "Enviar recuperação de senha" : action?.kind === "email" ? "Trocar e-mail de acesso" : action?.kind === "role" ? "Alterar permissões" : action?.enabled ? "Conceder gratuidade" : "Revogar gratuidade"}</DialogTitle><DialogDescription>{action?.user.nome} · {action?.user.email}</DialogDescription></DialogHeader>
          {action?.kind === "reset" && <p className="text-sm">O link será enviado ao e-mail atual da conta. Nenhuma senha será exposta.</p>}
          {action?.kind === "email" && <div className="space-y-2"><Label htmlFor="admin-email">Novo e-mail</Label><Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><p className="text-sm text-muted-foreground">Esta ação altera imediatamente o e-mail usado para entrar. Confirme que ele pertence ao titular.</p></div>}
          {action?.kind === "role" && <Select value={role} onValueChange={(value) => setRole(value as typeof role)}><SelectTrigger aria-label="Novo papel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Administrador da biblioteca</SelectItem><SelectItem value="bibliotecario">Bibliotecário</SelectItem><SelectItem value="membro">Membro</SelectItem></SelectContent></Select>}
          {action?.kind === "free" && (action.enabled ? <div className="space-y-2"><p className="text-sm">A assinatura recorrente existente será cancelada. A biblioteca terá livros ilimitados sem ser alterada pelo Asaas.</p><Label htmlFor="free-reason">Motivo da concessão</Label><Input id="free-reason" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></div> : <p className="text-sm">O acervo será preservado, mas novos livros exigirão a ativação do Pro. Nenhuma cobrança será criada automaticamente.</p>)}
          <DialogFooter className="gap-3"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy || (action?.kind === "free" && action.enabled && !reason.trim())} onClick={submit}>{busy ? "Processando…" : "Confirmar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
