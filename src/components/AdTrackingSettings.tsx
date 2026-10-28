import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetaCapiStatus, retryMetaCapiEvents } from "@/lib/marketing.functions";
import { Radio, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdTrackingSettings() {
  const statusFn = useServerFn(getMetaCapiStatus);
  const retryFn = useServerFn(retryMetaCapiEvents);
  const [retrying, setRetrying] = useState(false);
  const status = useQuery({ queryKey: ["meta-capi-status"], queryFn: () => statusFn() });
  const retry = async () => {
    setRetrying(true);
    try { await retryFn(); await status.refetch(); toast.success("Reenvio processado. Confira o estado dos eventos."); }
    catch { toast.error("Não foi possível processar o reenvio."); }
    finally { setRetrying(false); }
  };
  const [meta, setMeta] = useState("");
  const [google, setGoogle] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, refetch } = useQuery({ queryKey: ["ad-settings"], queryFn: async () => {
    const { data, error } = await supabase.from("platform_settings").select("key,value");
    if (error) throw error;
    return data;
  } });
  useEffect(() => { if (data) { setMeta(data.find((x) => x.key === "meta_pixel_id")?.value ?? ""); setGoogle(data.find((x) => x.key === "google_ads_id")?.value ?? ""); } }, [data]);
  const save = async () => {
    if (meta && !/^\d{8,20}$/.test(meta)) return toast.error("Informe apenas o ID numérico do Meta Pixel");
    if (google && !/^AW-\d{8,14}$/.test(google)) return toast.error("Informe a tag do Google Ads no formato AW-123456789");
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("platform_settings").upsert([
      { key: "meta_pixel_id", value: meta, updated_at: new Date().toISOString(), updated_by: auth.user?.id },
      { key: "google_ads_id", value: google, updated_at: new Date().toISOString(), updated_by: auth.user?.id },
    ]);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pixels salvos. Aplicados nas próximas visitas com consentimento.");
    await refetch();
  };
  return <section className="space-y-4 border-t border-border pt-6" aria-label="Rastreamento de anúncios"><div className="flex items-center gap-2"><Radio className="size-5 text-primary" /><h2 className="text-xl font-semibold">Rastreamento de anúncios</h2></div><div className="space-y-2"><Label htmlFor="meta-pixel">ID do Meta Pixel</Label><Input id="meta-pixel" inputMode="numeric" placeholder="123456789012345" value={meta} onChange={(e) => setMeta(e.target.value.trim())} /></div><div className="space-y-2"><Label htmlFor="google-ads">ID da tag do Google Ads</Label><Input id="google-ads" placeholder="AW-123456789" value={google} onChange={(e) => setGoogle(e.target.value.trim().toUpperCase())} /></div><p className="text-sm text-muted-foreground">Deixe um campo vazio para desativar. As tags oficiais registram visitas, cadastro e contato somente após o visitante aceitar cookies de publicidade.</p><Button onClick={save} disabled={busy}><Save className="size-4" />{busy ? "Salvando…" : "Salvar pixels"}</Button>
    <div className="space-y-3 rounded-md border p-4" aria-label="API de Conversões do Meta">
      <h3 className="font-semibold">API de Conversões do Meta</h3>
      {status.isError ? <p role="alert">Não foi possível consultar os envios.</p> : !status.data ? <p>Consultando configuração…</p> : <>
        <p>{status.data.tokenConfigured ? "Credencial de envio configurada." : "Aguardando a credencial META_CAPI_ACCESS_TOKEN nos segredos do projeto Lovable."}</p>
        <p className="text-sm text-muted-foreground">Pagamentos e primeira assinatura são enviados pelo servidor após confirmação do Asaas e com consentimento. O início do pagamento é medido pelo pixel. A conferência abaixo mostra até 200 registros recentes.</p>
        <ul className="space-y-1 text-sm">{Object.entries(status.data.counts).map(([label, count]) => <li key={label}>{label}: {count}</li>)}</ul>
        {Object.keys(status.data.counts).length === 0 && <p className="text-sm">Nenhum evento financeiro registrado.</p>}
        {status.data.lastError && <p className="text-sm" role="status">Diagnóstico: {status.data.lastError}</p>}
        <Button type="button" variant="outline" disabled={retrying || !status.data.tokenConfigured} onClick={retry}>{retrying ? "Processando…" : "Reenviar pendentes"}</Button>
        <p className="text-xs text-muted-foreground">Eventos com mais de sete dias expiram. O reenvio também pode ser agendado por um endpoint protegido; uma agenda automática ainda não está configurada.</p>
      </>}
    </div>
  </section>;
}
