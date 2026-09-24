# Livronauta SaaS: várias bibliotecas + assinaturas Asaas

## Decisões
- Pagamentos: Asaas (Pix, boleto e cartão recorrente).
- Plano gratuito: até 150 livros por biblioteca.
- Plano Pro (valor a definir por você): livros ilimitados.
- Seu acervo atual vira a "Biblioteca principal", sem perder nada e sem limite.

## Etapa 1: separar as bibliotecas
- Nova tabela de bibliotecas (nome, dono, plano, status da assinatura).
- Nova tabela de membros da biblioteca (usuário + papel: admin, bibliotecário ou membro por biblioteca).
- Coluna `library_id` em livros, categorias, prateleiras, etiquetas, empréstimos, solicitações, reservas, configurações, importações e auditoria.
- Preencher todos os registros atuais com a Biblioteca principal; todos os usuários atuais viram membros dela com os papéis de hoje.
- Regras de acesso reescritas: cada pessoa só vê os dados das bibliotecas de que participa.
- Funções do banco (empréstimo, importação, mesclagem, devolução) passam a respeitar a biblioteca.

## Etapa 2: cadastro e troca de biblioteca
- Novo cadastro: opção "Criar minha biblioteca" (vira admin dela, plano gratuito) ou "Entrar por convite".
- Convites por link/e-mail para membros e bibliotecários.
- Seletor de biblioteca na barra lateral para quem participa de mais de uma.

## Etapa 3: limite do plano gratuito
- Bloqueio no banco ao passar de 150 livros no plano gratuito (vale para cadastro manual e importação CSV).
- Aviso no painel mostrando uso (ex.: 120/150) e botão "Fazer upgrade".

## Etapa 4: assinaturas Asaas
- Você cria conta no Asaas e gera a chave de API (primeiro no ambiente de testes/sandbox).
- Página "Plano e cobrança": escolher Pro, pagar via Pix/boleto/cartão, ver status e cancelar.
- Endereço de retorno (webhook) para o Asaas avisar pagamentos confirmados, atrasados ou cancelados; o plano da biblioteca muda automaticamente.
- Atraso de pagamento: carência de 7 dias, depois volta ao limite gratuito (somente leitura acima de 150, nada é apagado).

## Detalhes técnicos
- Isolamento por linha com função `is_library_member(library_id, role)` security definer.
- Trigger de limite em `books` checando o plano da biblioteca.
- Integração Asaas via funções de servidor + rota pública de webhook validando token de acesso do Asaas.
- Segredos necessários: `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`.

## Precisamos de você
- Valor mensal (e anual, se quiser) do plano Pro.
- Conta Asaas criada (a chave será pedida só na Etapa 4).
