# Plano gratuito de 100 livros, Pro a R$ 14,99 pelo Asaas e página inicial

## 1. Limite gratuito: 100 livros
- O limite do plano gratuito cai de 150 para 100 livros por biblioteca, tanto no bloqueio quanto nos avisos (menu e página "Plano e bibliotecas").
- Bibliotecas gratuitas que já passaram de 100 livros não perdem nada: só não conseguem cadastrar livros novos.
- A sua biblioteca principal continua sem limite.

## 2. Assinatura Pro pelo Asaas (R$ 14,99/mês)
- Um formulário seguro pede a sua chave de API do Asaas e um token para o endereço de retorno. Você também escolhe entre ambiente de testes ou produção.
- Em "Plano e bibliotecas", o botão "Fazer upgrade" passa a funcionar:
  - pede nome, CPF/CNPJ e e-mail de quem paga;
  - cria a assinatura mensal de R$ 14,99 no Asaas;
  - abre a página de pagamento do Asaas (Pix, boleto ou cartão).
- Endereço de retorno público: o Asaas avisa quando um pagamento é confirmado, fica atrasado ou é cancelado.
  - Pago: a biblioteca vira Pro, sem limite.
  - Atrasado: 7 dias de carência; depois volta ao limite gratuito, sem apagar nada.
  - Cancelado: volta ao gratuito.
- A mesma página mostra o status da assinatura, a próxima cobrança e um botão "Cancelar assinatura".
- Quando estiver pronto, eu mostro o endereço de retorno para você colar no painel do Asaas, junto com o mesmo token.

## 3. Página inicial pública (landing page)
- O endereço principal deixa de mandar direto para o login e passa a mostrar uma página de apresentação, no mesmo estilo visual da página de login atual: fundo claro com brilho laranja no topo, cartões brancos e detalhes em azul-marinho.
- A nova logo que você enviou (a placa laranja com o "L") passa a ser usada na página inicial, no login, no menu do sistema e no ícone da aba.
- **Menu superior:** logo Livronauta, links "Vantagens", "Planos" e "Contato", e o botão "Entrar" em laranja cheio (a cor principal do login), além de "Criar conta grátis".
- **Abertura com a oferta principal:** uma chamada forte sobre ter a biblioteca organizada, com o selo "Comece grátis, sem cartão e sem pagamento".
- **Antes e depois:** sem organização (livros perdidos, empréstimos esquecidos, compras repetidas) comparado ao Livronauta (tudo catalogado, lembretes de devolução, busca em segundos).
- **Vantagens:** leitor de código de barras e busca por ISBN, importação do Libib, empréstimos com multas e solicitações, etiquetas com código de barras e QR Code, várias pessoas por biblioteca e uso no celular.
- **Planos com oferta:** Gratuito (até 100 livros, para sempre) e Pro (R$ 14,99/mês, livros ilimitados, "menos de R$ 0,50 por dia"). Ambos com o selo "sem cartão para começar".
- **Contato:**
  - formulário com nome, e-mail e mensagem;
  - as mensagens ficam salvas e aparecem para o administrador numa nova tela "Mensagens de contato";
  - o e-mail atendimento@triregnum.com.br também aparece para contato direto.
- **Rodapé:** links para Termos de uso, Política de privacidade e Contato.
- **Novas páginas "Termos de uso" e "Política de privacidade":** textos-padrão em português, adaptados ao Livronauta e à LGPD, citando o Asaas como processador de pagamentos e o contato atendimento@triregnum.com.br. Vale você revisar esses textos, ou pedir a um advogado, antes de divulgar o site.
- Quem já está conectado é levado direto para o painel.
- A página tem título e descrição próprios para buscadores e compartilhamento.

## 4. Página de login
- Destaque no topo do cartão: "Comece grátis — sem dados de cartão ou pagamento".
- A frase antiga "Novas contas começam como Membro" é trocada por "Sua conta já vem com sua própria biblioteca gratuita".
- Link para voltar à página inicial.

## Detalhes técnicos
- Uma nova migração altera o limite para 100 em `enforce_book_limit` e `library_usage`.
- Segredos: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENV` (sandbox/production), que define a URL base da API.
- Funções de servidor com autenticação, usadas só pelo admin da biblioteca ativa:
  - `createAsaasSubscription`: cria ou reutiliza o cliente no Asaas e cria a assinatura com ciclo MONTHLY, valor 14.99 e forma de pagamento UNDEFINED. Devolve o `invoiceUrl` do primeiro pagamento.
  - `cancelAsaasSubscription`.
- Nos dois casos, `asaas_customer_id` e `asaas_subscription_id` são gravados pelo cliente administrativo.
- Webhook em `/api/public/asaas-webhook`:
  - valida o cabeçalho `asaas-access-token`;
  - trata PAYMENT_CONFIRMED/RECEIVED → plano pro/ativo, PAYMENT_OVERDUE → carência de 7 dias, SUBSCRIPTION_DELETED/INACTIVATED → gratuito.
- A carência é verificada no trigger de limite comparando `current_period_end` + 7 dias.
- A landing page usa o arquivo de rota da página inicial, com redirecionamento no navegador apenas quando já existe uma sessão.
- Novas rotas públicas: `/termos` e `/privacidade`.
- Logo: o SVG enviado vira o componente `BrandMark` (em linha) e é salvo em `public/favicon.svg`.
- Nova tabela `contact_messages` (nome, email, mensagem):
  - INSERT permitido para visitantes (anon), via função de servidor com validação zod e limites de tamanho;
  - SELECT somente para administradores.
