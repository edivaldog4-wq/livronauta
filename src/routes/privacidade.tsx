import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, CONTACT_EMAIL } from "@/components/SiteChrome";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — Livronauta" },
      { name: "description", content: "Como o Livronauta coleta, usa e protege seus dados, conforme a LGPD." },
      { property: "og:title", content: "Política de privacidade — Livronauta" },
      { property: "og:description", content: "Como o Livronauta coleta, usa e protege seus dados, conforme a LGPD." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://livronauta.lovable.app/privacidade" }],
  }),
  component: () => (
    <PublicShell>
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
        <h1 className="text-3xl font-bold">Política de privacidade</h1>
        <p>Última atualização: setembro de 2026. Esta política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>
        <h2>1. Dados que coletamos</h2>
        <p>Dados de cadastro (nome, e-mail, telefone e endereço opcionais), dados do acervo que você cadastra, registros de empréstimos e dados de uso necessários ao funcionamento. Pelo formulário de contato, coletamos nome, e-mail e mensagem.</p>
        <h2>2. Finalidade</h2>
        <p>Prestar o serviço, autenticar seu acesso, processar assinaturas, prestar suporte e melhorar a plataforma. Não vendemos seus dados.</p>
        <h2>3. Pagamentos</h2>
        <p>Assinaturas são processadas pelo Asaas. Dados de pagamento (como cartão) são tratados diretamente pelo Asaas; nós armazenamos apenas identificadores da assinatura e seu status.</p>
        <h2>4. Compartilhamento</h2>
        <p>Os dados de uma biblioteca são visíveis apenas às pessoas que participam dela, conforme o papel de cada uma. Compartilhamos dados com provedores de infraestrutura e pagamento estritamente para operar o serviço, ou quando exigido por lei.</p>
        <h2>5. Segurança e retenção</h2>
        <p>Usamos conexões criptografadas e controle de acesso por biblioteca. Mantemos os dados enquanto a conta estiver ativa ou pelo prazo exigido por lei.</p>
        <h2>6. Seus direitos</h2>
        <p>Você pode solicitar acesso, correção, portabilidade ou exclusão dos seus dados, e revogar consentimentos, pelo e-mail abaixo.</p>
        <h2>7. Cookies</h2>
        <p>Usamos apenas armazenamento local essencial para manter sua sessão conectada.</p>
        <h2>8. Contato do encarregado</h2>
        <p><a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </article>
    </PublicShell>
  ),
});
