import { createFileRoute, Link } from "@tanstack/react-router";
import { CircleHelp, Mail } from "lucide-react";
import { PublicShell } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Livronauta" },
      { name: "description", content: "Respostas sobre cadastro, planos, segurança, backup, importação e uso do Livronauta." },
      { property: "og:title", content: "Ajuda — Livronauta" },
      { property: "og:description", content: "Tire suas dúvidas sobre cadastro, planos e organização da sua biblioteca." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HelpPage,
});

const questions = [
  ["O que ocorre se eu cancelar o plano com mais de 50 livros?", "Seu acervo continua salvo e disponível para consulta e backup. Novos cadastros ficam bloqueados até você reduzir o acervo a 50 livros ou reativar o plano Pro."],
  ["Caso eu exclua minha conta, algum dado continuará salvo?", "A solicitação pode ser cancelada durante 30 dias. Depois desse prazo, a exclusão é definitiva e remove a conta e as bibliotecas de sua titularidade. Antes de solicitar, faça um backup. Registros necessários para obrigações legais podem ser preservados pelo período exigido em lei."],
  ["Onde meus dados ficam hospedados?", "Os dados são mantidos em infraestrutura de nuvem protegida, com controle de acesso e separação entre bibliotecas. Cada pessoa só acessa as bibliotecas das quais participa."],
  ["Posso fazer backup dos meus dados?", "Sim. Em Configurações, administradores podem exportar um backup completo em JSON e restaurá-lo quando necessário. Também é possível exportar o acervo em CSV."],
  ["O valor do plano muda anualmente?", "Não temos previsão de mudanças constantes, pois nosso modelo de trabalho se baseia em volume de assinaturas, não em elevação de valores anuais. Qualquer alteração futura será comunicada previamente."],
  ["Qual a diferença entre importar acervo e importar backup?", "Importar acervo recebe uma planilha CSV, como a exportada pelo Libib, e cria livros com detecção de duplicados. Importar backup restaura um arquivo JSON completo do Livronauta, incluindo dados relacionados da biblioteca."],
  ["Existe alguma limitação de cadastro de livros?", "O plano Gratuito permite até 50 registros de livros. O plano Pro não impõe esse limite de acervo. Cada registro pode representar um título ou exemplar, conforme sua organização."],
  ["Como inserir usuários em meu acervo?", "O administrador encontra o código de convite em Plano e bibliotecas. A outra pessoa cria uma conta, informa esse código e passa a participar da biblioteca como membro."],
  ["Consigo fazer edições em massa?", "Sim. No Acervo, selecione vários livros para alterar categoria, estante e outros campos compatíveis de uma só vez."],
  ["Meus dados podem ser compartilhados com terceiros?", "Não vendemos seus dados pessoais. O tratamento segue a Política de Privacidade e ocorre somente para operar o serviço, cumprir obrigações legais e usar fornecedores essenciais sob proteção contratual."],
  ["Como funcionam etiquetas, QR Code e código de barras?", "As etiquetas geradas pelo Livronauta identificam cada livro. A equipe pode ler o QR Code ou código de barras no atalho Empréstimo e localizar o registro correto antes de escolher o usuário."],
  ["Como registrar e devolver um empréstimo?", "A equipe escolhe ou escaneia o livro, seleciona o membro e registra o empréstimo. Na página Empréstimos, é possível ajustar o prazo, imprimir o comprovante e registrar a devolução."],
];

function HelpPage() {
  return (
    <PublicShell>
      <main className="bg-background">
        <section className="border-b border-border bg-secondary text-secondary-foreground">
          <div className="mx-auto max-w-4xl px-4 py-12 md:py-16">
            <CircleHelp className="mb-4 h-9 w-9 text-primary" />
            <h1 className="text-3xl font-bold md:text-4xl">Central de ajuda</h1>
            <p className="mt-3 max-w-2xl text-secondary-foreground/75">Respostas diretas para organizar sua biblioteca com segurança.</p>
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
          <Accordion type="single" collapsible className="border-t">
            {questions.map(([question, answer], index) => (
              <AccordionItem key={question} value={`item-${index}`}>
                <AccordionTrigger className="text-base">{question}</AccordionTrigger>
                <AccordionContent className="leading-6 text-muted-foreground">{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-8">
            <div>
              <h2 className="font-semibold">Ainda precisa de ajuda?</h2>
              <p className="text-sm text-muted-foreground">Fale com a equipe pelo formulário de contato.</p>
            </div>
            <Button asChild><Link to="/" hash="contato"><Mail className="mr-2 h-4 w-4" />Entrar em contato</Link></Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}