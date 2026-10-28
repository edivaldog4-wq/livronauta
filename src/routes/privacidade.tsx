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
    links: [{ rel: "canonical", href: "https://livronauta.app/privacidade" }],
  }),
  component: () => (
    <PublicShell>
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
        <h1 className="text-3xl font-bold">Política de privacidade</h1>
        <p>Última atualização: outubro de 2026. Esta política segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).</p>
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
        <p>Usamos armazenamento local essencial para manter sua sessão conectada. Com sua autorização, também usamos cookies e identificadores do Meta Ads e Google Ads para medir campanhas. Quando você autoriza a medição, registramos cadastro, início do pagamento, pagamentos confirmados e a primeira assinatura paga. Enviamos à Meta o tipo, a data, o valor e a moeda do evento, seu e-mail normalizado e transformado em hash SHA-256, um identificador de conta também em hash e, quando disponíveis, identificadores de publicidade, endereço IP e informações do navegador. O hash auxilia na correspondência de eventos e não torna os dados anônimos. As confirmações financeiras são enviadas pelo servidor por meio da API de Conversões. Esses recursos permanecem desativados se você recusar e o consentimento pode ser alterado pelo botão “Cookies”. A retirada do consentimento impede novos envios publicitários associados à sua conta e não altera seu acesso pago. Os registros financeiros necessários ao serviço são mantidos independentemente dos cookies opcionais. Não enviamos dados do acervo, dos empréstimos, CPF ou dados de cartão a essas plataformas.</p>
        <h2>8. Contato do encarregado</h2>
        <p><a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </article>
    </PublicShell>
  ),
});
