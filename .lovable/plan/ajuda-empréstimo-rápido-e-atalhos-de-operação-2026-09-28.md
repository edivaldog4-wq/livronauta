# Ajuda, empréstimo rápido e atalhos de operação

## Objetivo

Criar uma central de ajuda acessível antes e depois do login, facilitar a importação e o empréstimo de livros e renomear “Auditoria” para “Histórico”.

## 1. Página Ajuda

- Criar a página pública `/ajuda`, seguindo a identidade visual do Livronauta e funcionando bem no celular.
- Adicionar acesso à Ajuda no menu da página pública, no rodapé e no menu lateral de usuários conectados.
- Organizar o conteúdo em busca e perguntas expansíveis, separadas por temas: primeiros passos, planos e cobrança, acervo e importação, usuários e empréstimos, etiquetas, backup, privacidade, segurança e encerramento da conta.
- Explicar os principais benefícios do sistema e responder, no mínimo:
  1. Ao cancelar o Pro com mais de 100 livros, nenhum livro será apagado; o acervo continuará disponível, mas novos cadastros ficarão bloqueados até reduzir para 100 ou reativar o Pro.
  2. A exclusão da conta terá prazo de 30 dias para cancelamento; depois será definitiva, ressalvados dados mínimos que precisem ser mantidos por obrigação legal.
  3. Os dados ficam em infraestrutura segura na nuvem, com acesso isolado por biblioteca e conexões protegidas.
  4. Administradores podem exportar e restaurar backup nas Configurações.
  5. Não há previsão de reajustes constantes: o modelo prioriza volume de assinaturas, não elevações anuais; qualquer mudança relevante será informada previamente.
  6. O Gratuito permite até 100 livros; o Pro custa R$ 14,99/mês e não limita o acervo.
  7. O plano gratuito tem limite de 100 livros; o Pro é ilimitado.
  8. Pessoas entram por código de convite, disponível em “Plano e bibliotecas”.
  9. O Acervo permite selecionar vários livros e aplicar edições em massa.
  10. Dados não são vendidos; só são compartilhados com participantes autorizados, prestadores essenciais e quando a lei exigir.
- Incluir respostas adicionais sobre cadastro gratuito ou Pro, confirmação de e-mail, biblioteca de demonstração, busca por ISBN, duplicatas, CSV, etiquetas, empréstimos, devoluções, multas, permissões e contato.
- Oferecer links contextuais para Termos de uso, Política de privacidade e contato.

## 2. Exclusão de conta em 30 dias

- Acrescentar em Configurações uma ação específica para solicitar a exclusão completa da conta, separada da exclusão seletiva de dados já existente.
- Registrar a solicitação e a data prevista para exclusão, encerrar a sessão e impedir o uso normal enquanto estiver pendente.
- Permitir cancelar a solicitação dentro dos 30 dias após nova autenticação.
- Após o prazo, remover definitivamente a conta e os dados pertencentes exclusivamente à biblioteca do usuário, preservando dados compartilhados que pertençam a outra biblioteca e apenas o mínimo exigido por lei.
- Exibir confirmações claras antes da solicitação e orientar a realização de backup.

## 3. Atalho para importar acervo

- Adicionar na página “Histórico de importações” um botão destacado “Importar acervo”.
- O botão abrirá a página “Acervo” com a janela de importação CSV já aberta.
- Ampliar o controle do endereço da página Acervo para aceitar essa ação sem interferir no atalho existente de “Novo livro”.

## 4. Empréstimo rápido pelo menu

- Inserir “Empréstimo” logo abaixo de “Novo livro” no menu lateral, visível para administradores e bibliotecários.
- Abrir uma janela de empréstimo sem exigir a navegação prévia para outra página.
- Permitir localizar o livro por:
  - pesquisa por título, autor ou ISBN;
  - câmera;
  - foto do código;
  - digitação manual;
  - QR Code ou código de barras das etiquetas geradas pelo próprio Livronauta.
- Ao ler uma etiqueta interna, buscar primeiro o código gravado em Etiquetas e recuperar o livro correspondente; quando não for etiqueta interna, tentar o ISBN do acervo.
- Mostrar capa, título, autor, ISBN, localização e disponibilidade antes da confirmação.
- Selecionar o usuário da biblioteca por nome, e-mail ou número e registrar o empréstimo em nome dele, com prazo padrão de 14 dias.
- Após registrar, atualizar acervo, dashboard e empréstimos e oferecer o comprovante, preservando as mesmas regras e permissões da página de Empréstimos.
- Reaproveitar essa mesma janela na página de Empréstimos para evitar dois fluxos diferentes.

## 5. Auditoria passa a Histórico

- Criar o endereço autenticado `/historico`, mover para ele a listagem atual de alterações e trocar títulos, descrições, menu e chamadas de “Auditoria” para “Histórico”.
- Manter `/audit` funcionando como redirecionamento permanente para `/historico`, preservando favoritos antigos.
- Atualizar o botão de “Últimas modificações” no dashboard para apontar ao novo endereço.

## 6. Validação

- Conferir permissões: ajuda disponível a todos; empréstimo rápido somente para equipe; histórico somente para equipe; exclusão completa somente pelo titular administrador.
- Testar importação abrindo diretamente na janela correta.
- Testar empréstimo por pesquisa, ISBN, QR Code e código de barras gerado pelo Livronauta, confirmando a baixa de disponibilidade e a visualização do comprovante.
- Testar solicitação e cancelamento da exclusão dentro do prazo sem apagar contas existentes durante a validação.
- Conferir `/ajuda`, menu lateral, diálogos e tabelas em computador e celular.
- Validar os novos endereços, metadados próprios, compilação e controles de segurança.

## Detalhes técnicos

- Extrair o formulário atual de novo empréstimo para um componente compartilhado e acrescentar a resolução segura `labels.codigo_barras → labels.book_id → books` dentro da biblioteca ativa.
- Acrescentar o parâmetro de abertura da importação à validação de busca da rota de Acervo.
- Implementar o ciclo de exclusão com registro protegido por usuário, funções autenticadas e processamento agendado idempotente; nenhuma chave privilegiada será enviada ao navegador.
- Manter o isolamento por biblioteca e registrar as ações relevantes no Histórico.