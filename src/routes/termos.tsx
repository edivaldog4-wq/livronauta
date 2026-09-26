import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, CONTACT_EMAIL } from "@/components/SiteChrome";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Livronauta" },
      { name: "description", content: "Condições de uso da plataforma Livronauta de gestão de bibliotecas." },
      { property: "og:title", content: "Termos de uso — Livronauta" },
      { property: "og:description", content: "Condições de uso da plataforma Livronauta de gestão de bibliotecas." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://livronauta.lovable.app/termos" }],
  }),
  component: () => (
    <PublicShell>
      <article className="mx-auto max-w-3xl space-y-4 px-4 py-12 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:text-muted-foreground">
        <h1 className="text-3xl font-bold">Termos de uso</h1>
        <p>Última atualização: setembro de 2026.</p>
        <h2>1. Aceitação</h2>
        <p>Ao criar uma conta ou usar o Livronauta, você concorda com estes Termos. Se não concordar, não utilize a plataforma.</p>
        <h2>2. O serviço</h2>
        <p>O Livronauta é uma plataforma online para catalogar livros, controlar empréstimos, gerar etiquetas e compartilhar acervos com pessoas convidadas.</p>
        <h2>3. Conta e responsabilidades</h2>
        <p>Você é responsável pela veracidade dos dados informados, pela guarda da sua senha e por todo conteúdo cadastrado na sua biblioteca, inclusive dados de pessoas que você convidar.</p>
        <h2>4. Planos e pagamento</h2>
        <p>O plano Gratuito permite até 100 livros por biblioteca, sem custo. O plano Pro custa R$ 14,99 por mês, cobrado de forma recorrente através do Asaas (Pix, boleto ou cartão). Você pode cancelar a qualquer momento; o acesso Pro permanece até o fim do período pago. Em caso de atraso, há carência de 7 dias antes do retorno aos limites do plano Gratuito. Nenhum dado é apagado por mudança de plano.</p>
        <h2>5. Uso aceitável</h2>
        <p>É proibido usar a plataforma para fins ilegais, tentar acessar dados de outras bibliotecas, sobrecarregar o sistema ou violar direitos de terceiros.</p>
        <h2>6. Disponibilidade</h2>
        <p>Buscamos manter o serviço disponível continuamente, mas podem ocorrer interrupções para manutenção ou por fatores externos. Recomendamos exportar backups periodicamente.</p>
        <h2>7. Encerramento</h2>
        <p>Você pode encerrar sua conta a qualquer momento. Podemos suspender contas que violem estes Termos.</p>
        <h2>8. Limitação de responsabilidade</h2>
        <p>O serviço é fornecido "no estado em que se encontra". Não nos responsabilizamos por perdas indiretas decorrentes do uso da plataforma, dentro dos limites da lei.</p>
        <h2>9. Alterações</h2>
        <p>Estes Termos podem ser atualizados. Mudanças relevantes serão comunicadas na plataforma.</p>
        <h2>10. Contato e foro</h2>
        <p>Dúvidas: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Aplica-se a legislação brasileira.</p>
      </article>
    </PublicShell>
  ),
});
