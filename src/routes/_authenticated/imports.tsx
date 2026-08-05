import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { downloadText } from "@/lib/libib-csv";
import Papa from "papaparse";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({
    meta: [
      { title: "Histórico de importações — Livronauta" },
      { name: "description", content: "Registro completo de cada importação de CSV: linhas lidas, livros adicionados, somados, ignorados e o motivo de cada falha." },
      { property: "og:title", content: "Histórico de importações — Livronauta" },
      { property: "og:description", content: "Auditoria detalhada das importações de acervo, linha por linha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportsPage,
});

const PAGE_SIZE = 15;

const OUTCOME: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  imported: { label: "Adicionado", variant: "default" },
  merged: { label: "Somado ao existente", variant: "secondary" },
  updated: { label: "Atualizado", variant: "secondary" },
  skipped: { label: "Ignorado", variant: "outline" },
  error: { label: "Erro", variant: "destructive" },
};

const RESOLUTION: Record<string, string> = {
  import: "Criar novo registro",
  merge: "Somar como exemplar",
  overwrite: "Atualizar sem somar",
  skip: "Ignorar",
};

function ImportsPage() {
  const { isStaff } = useAuth();
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<any | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["import-logs", page],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from("import_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (!isStaff) {
    return <p className="text-muted-foreground">Acesso restrito à equipe da biblioteca.</p>;
  }

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  const details: any[] = Array.isArray(detail?.details) ? detail.details : [];
  const filteredDetails = outcomeFilter === "all" ? details : details.filter((d) => d.outcome === outcomeFilter);

  const exportDetails = () => {
    if (!detail) return;
    const csv = Papa.unparse(
      details.map((d) => ({
        titulo: d.titulo ?? "",
        autor: d.autor ?? "",
        isbn: d.isbn ?? "",
        acao_escolhida: RESOLUTION[d.resolution] ?? d.resolution ?? "",
        resultado: OUTCOME[d.outcome]?.label ?? d.outcome ?? "",
        motivo: d.motivo ?? "",
      })),
    );
    downloadText(`importacao-${String(detail.created_at).slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6 text-primary" /> Histórico de importações
        </h1>
        <p className="text-sm text-muted-foreground">
          Cada importação de CSV registrada com o resultado linha por linha, incluindo o motivo de cada falha.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações realizadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Linhas</TableHead>
                  <TableHead className="text-right">Adicionados</TableHead>
                  <TableHead className="text-right">Somados</TableHead>
                  <TableHead className="text-right">Atualizados</TableHead>
                  <TableHead className="text-right">Ignorados</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
                )}
                {!isLoading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhuma importação registrada ainda.</TableCell></TableRow>
                )}
                {rows.map((r: any) => {
                  const errs = Array.isArray(r.errors) ? r.errors.length : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={r.filename ?? ""}>{r.filename ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.actor_email ?? "—"}</TableCell>
                      <TableCell className="text-right">{r.total_rows}</TableCell>
                      <TableCell className="text-right font-medium">{r.imported}</TableCell>
                      <TableCell className="text-right">{r.merged}</TableCell>
                      <TableCell className="text-right">{r.updated}</TableCell>
                      <TableCell className="text-right">{r.skipped}</TableCell>
                      <TableCell className="text-right">
                        {errs > 0 ? <Badge variant="destructive">{errs}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setDetail(r); setOutcomeFilter("all"); }}>
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Importação de {detail ? new Date(detail.created_at).toLocaleString("pt-BR") : ""}
            </DialogTitle>
          </DialogHeader>

          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">{detail.total_rows} linhas no arquivo</Badge>
                <Badge variant="secondary">{detail.selected_rows} enviadas</Badge>
                <Badge>{detail.imported} adicionados</Badge>
                <Badge variant="secondary">{detail.merged} somados</Badge>
                <Badge variant="secondary">{detail.updated} atualizados</Badge>
                <Badge variant="outline">{detail.skipped} ignorados</Badge>
                {Array.isArray(detail.errors) && detail.errors.length > 0 && (
                  <Badge variant="destructive">{detail.errors.length} erros</Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
                  <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os resultados</SelectItem>
                    <SelectItem value="imported">Adicionados</SelectItem>
                    <SelectItem value="merged">Somados ao existente</SelectItem>
                    <SelectItem value="updated">Atualizados</SelectItem>
                    <SelectItem value="skipped">Ignorados</SelectItem>
                    <SelectItem value="error">Erros</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={exportDetails} disabled={details.length === 0}>
                  Baixar detalhe em CSV
                </Button>
              </div>

              {details.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Esta importação foi registrada antes do detalhamento linha por linha estar disponível.
                </p>
              ) : (
                <div className="overflow-x-auto max-h-[50vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Autor</TableHead>
                        <TableHead>ISBN</TableHead>
                        <TableHead>Ação escolhida</TableHead>
                        <TableHead>Resultado</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDetails.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="max-w-[240px] truncate font-medium" title={d.titulo}>{d.titulo}</TableCell>
                          <TableCell className="text-sm">{d.autor || "—"}</TableCell>
                          <TableCell className="text-xs font-mono">{d.isbn || "—"}</TableCell>
                          <TableCell className="text-sm">{RESOLUTION[d.resolution] ?? d.resolution}</TableCell>
                          <TableCell>
                            <Badge variant={OUTCOME[d.outcome]?.variant ?? "outline"}>
                              {OUTCOME[d.outcome]?.label ?? d.outcome}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[280px]">{d.motivo || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
