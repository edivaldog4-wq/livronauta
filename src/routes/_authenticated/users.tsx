import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Usuários — Biblioteca" }] }),
  component: UsersPage,
});

function UsersPage() {
  const { isStaff, isAdmin, user: me } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["users", search],
    queryFn: async () => {
      let q = supabase.from("profiles").select("*").order("nome");
      if (search.trim()) q = q.or(`nome.ilike.%${search}%,email.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  const roleOf = (uid: string) => {
    const r = roles.find((x: any) => x.user_id === uid);
    return r?.role ?? "membro";
  };

  const changeRole = async (uid: string, newRole: "admin" | "bibliotecario" | "membro") => {
    if (!isAdmin) return toast.error("Apenas administradores podem alterar papéis");
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: newRole });
    if (error) return toast.error(error.message);
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["all-roles"] });
  };

  const handleDelete = async (uid: string) => {
    if (uid === me?.id) return toast.error("Você não pode excluir seu próprio perfil");
    if (!confirm("Excluir este usuário?")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success("Perfil excluído (a conta de login permanece)");
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const updateProfile = async (uid: string, patch: any) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  if (!isStaff) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center text-muted-foreground">Acesso restrito.</CardContent></Card></div>;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Usuários</h1>
        <p className="text-muted-foreground text-sm">Gerencie os membros do sistema</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou email" className="pl-9 max-w-md" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Input className="h-8" defaultValue={p.nome} onBlur={(e) => e.target.value !== p.nome && updateProfile(p.id, { nome: e.target.value })} />
                    </TableCell>
                    <TableCell className="text-sm">{p.email}</TableCell>
                    <TableCell>
                      <Input className="h-8" defaultValue={p.telefone ?? ""} onBlur={(e) => updateProfile(p.id, { telefone: e.target.value || null })} />
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select value={roleOf(p.id)} onValueChange={(v) => changeRole(p.id, v as any)}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="membro">Membro</SelectItem>
                            <SelectItem value="bibliotecario">Bibliotecário</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{roleOf(p.id)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.data_cadastro && new Date(p.data_cadastro).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive">Excluir</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Novos usuários se cadastram através da tela de login. Edite os campos diretamente clicando neles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
