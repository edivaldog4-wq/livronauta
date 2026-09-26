import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ScanBarcode, FileUp, RefreshCw, Tag, Users, Smartphone, Check, X, ShieldCheck, Mail, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import { PublicShell, CONTACT_EMAIL } from "@/components/SiteChrome";

const TITLE = "Livronauta — Sua biblioteca organizada, grátis para começar";
const DESC = "Catalogue seus livros com o celular, controle empréstimos e imprima etiquetas. Comece grátis, sem cartão.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://livronauta.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://livronauta.lovable.app/" }],
  }),
  component: Landing,
});

const features = [
  { icon: ScanBarcode, t: "Cadastro em segundos", d: "Aponte a câmera para o código de barras ou digite o ISBN: capa, autor e editora preenchidos automaticamente." },
  { icon: FileUp, t: "Traga seu acervo do Libib", d: "Importe sua planilha CSV de uma vez, com detecção inteligente de duplicados." },
  { icon: RefreshCw, t: "Empréstimos sem esquecimento", d: "Saiba quem está com cada livro, datas de devolução, multas e solicitações dos leitores." },
  { icon: Tag, t: "Etiquetas profissionais", d: "Imprima etiquetas com código de barras e QR Code em papel A4 ou impressora térmica." },
  { icon: Users, t: "Família, clube ou escola", d: "Convide pessoas com um código. Cada uma vê o catálogo e pede empréstimos." },
  { icon: Smartphone, t: "No bolso, em qualquer lugar", d: "Funciona no celular, tablet e computador. Consulte seu acervo na livraria antes de comprar." },
];

const contactSchema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  mensagem: z.string().trim().min(5, "Escreva sua mensagem").max(2000),
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard" }); });
  }, [navigate]);

  return (
    <PublicShell>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-1 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" /> Comece grátis, sem cartão e sem pagamento
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Cada livro no lugar.<br /><span className="text-primary">Nenhum empréstimo perdido.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            O Livronauta transforma estantes bagunçadas em uma biblioteca de verdade: catálogo pesquisável, controle de empréstimos e etiquetas — tudo pelo celular.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-7 text-base font-semibold shadow-lg"><Link to="/auth">Criar minha biblioteca grátis</Link></Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base"><a href="#planos">Ver planos</a></Button>
          </div>
          <p className="text-sm text-muted-foreground">Até 100 livros grátis para sempre · Pronto em 1 minuto</p>
        </div>
        <Card className="shadow-xl">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <BrandMark />
              <div>
                <div className="font-semibold">Minha Biblioteca</div>
                <div className="text-sm text-muted-foreground">1.186 livros · 12 emprestados</div>
              </div>
            </div>
            {[
              ["Dom Casmurro", "Machado de Assis", "Disponível"],
              ["Grande Sertão: Veredas", "Guimarães Rosa", "Com Ana · devolve 12/10"],
              ["A Hora da Estrela", "Clarice Lispector", "Disponível"],
            ].map(([t, a, s]) => (
              <div key={t} className="flex items-center justify-between rounded-md border p-3">
                <div><div className="text-sm font-medium">{t}</div><div className="text-xs text-muted-foreground">{a}</div></div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${s === "Disponível" ? "bg-accent" : "bg-muted"}`}>{s}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Antes e depois */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-8 text-center text-3xl font-bold">Quanto custa uma biblioteca desorganizada?</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardContent className="space-y-3 p-6">
            <div className="text-lg font-semibold text-muted-foreground">Sem organização</div>
            {["Livros emprestados que nunca voltaram", "Comprar de novo um título que você já tinha", "Minutos procurando um livro na estante", "Ninguém sabe o que existe no acervo"].map((x) => (
              <div key={x} className="flex gap-2 text-sm"><X className="h-5 w-5 shrink-0 text-destructive" />{x}</div>
            ))}
          </CardContent></Card>
          <Card className="border-primary shadow-lg"><CardContent className="space-y-3 p-6">
            <div className="text-lg font-semibold">Com o Livronauta</div>
            {["Cada empréstimo com nome, data e lembrete de devolução", "Consulta pelo celular antes de comprar", "Busca por título, autor ou ISBN em segundos", "Catálogo bonito para compartilhar com quem você quiser"].map((x) => (
              <div key={x} className="flex gap-2 text-sm"><Check className="h-5 w-5 shrink-0 text-primary" />{x}</div>
            ))}
          </CardContent></Card>
        </div>
      </section>

      {/* Vantagens */}
      <section id="vantagens" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="mb-2 text-center text-3xl font-bold">Tudo o que sua biblioteca precisa</h2>
        <p className="mb-10 text-center text-muted-foreground">Feito para bibliotecas de casa, clubes do livro, igrejas e escolas.</p>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.t} className="transition-shadow hover:shadow-lg"><CardContent className="space-y-2 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><f.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{f.t}</div>
              <p className="text-sm text-muted-foreground">{f.d}</p>
            </CardContent></Card>
          ))}
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16">
        <h2 className="mb-2 text-center text-3xl font-bold">Um preço que cabe no bolso</h2>
        <p className="mb-10 text-center text-muted-foreground">Comece grátis, sem dados de cartão. Faça upgrade só se precisar.</p>
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="text-lg font-semibold">Gratuito</div>
            <div className="text-4xl font-extrabold">R$ 0</div>
            <ul className="flex-1 space-y-2 text-sm">
              {["Até 100 livros, para sempre", "Leitor de código de barras", "Controle de empréstimos", "Etiquetas e QR Code"].map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{x}</li>)}
            </ul>
            <Button asChild variant="outline" className="h-11"><Link to="/auth">Começar grátis</Link></Button>
          </CardContent></Card>
          <Card className="relative border-2 border-primary shadow-xl"><CardContent className="flex h-full flex-col gap-4 p-6">
            <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"><Sparkles className="h-3 w-3" /> Mais escolhido</span>
            <div className="text-lg font-semibold">Pro</div>
            <div><span className="text-4xl font-extrabold">R$ 14,99</span><span className="text-muted-foreground">/mês</span></div>
            <div className="text-sm font-medium text-primary">Menos de R$ 0,50 por dia</div>
            <ul className="flex-1 space-y-2 text-sm">
              {["Livros ilimitados", "Importação completa do Libib", "Membros e bibliotecários ilimitados", "Pix, boleto ou cartão · cancele quando quiser"].map((x) => <li key={x} className="flex gap-2"><Check className="h-4 w-4 text-primary" />{x}</li>)}
            </ul>
            <Button asChild className="h-11 font-semibold"><Link to="/auth">Testar grátis agora</Link></Button>
            <p className="text-center text-xs text-muted-foreground">Sem cartão para começar</p>
          </CardContent></Card>
        </div>
      </section>

      <ContactSection />
    </PublicShell>
  );
}

function ContactSection() {
  const [form, setForm] = useState({ nome: "", email: "", mensagem: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert(parsed.data as any);
    setBusy(false);
    if (error) return toast.error("Não foi possível enviar. Tente pelo e-mail.");
    toast.success("Mensagem enviada! Responderemos em breve.");
    setForm({ nome: "", email: "", mensagem: "" });
  };
  return (
    <section id="contato" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16">
      <h2 className="mb-2 text-center text-3xl font-bold">Fale com a gente</h2>
      <p className="mb-8 text-center text-muted-foreground">
        Dúvidas, sugestões ou parcerias. Ou escreva para{" "}
        <a className="inline-flex items-center gap-1 font-medium text-foreground underline" href={`mailto:${CONTACT_EMAIL}`}><Mail className="h-4 w-4" />{CONTACT_EMAIL}</a>
      </p>
      <Card><CardContent className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="c-nome">Nome</Label><Input id="c-nome" maxLength={100} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-email">E-mail</Label><Input id="c-email" type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-msg">Mensagem</Label><Textarea id="c-msg" rows={5} maxLength={2000} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} /></div>
          <Button type="submit" disabled={busy} className="w-full h-11 font-semibold">{busy ? "Enviando..." : "Enviar mensagem"}</Button>
        </form>
      </CardContent></Card>
    </section>
  );
}
