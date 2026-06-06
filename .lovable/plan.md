# Sistema de Gestão de Biblioteca

Aplicação web completa para administração de bibliotecas domésticas/pequenas organizações, inspirada no Libib, com catálogo, empréstimos, usuários e impressão de etiquetas com código de barras. UI em português do Brasil.

## Stack
- React + TypeScript + TanStack Start (já configurado)
- Tailwind v4 + shadcn/ui (Sidebar, DataTable via TanStack Table, Dialog, Form, Card, Chart)
- **Lovable Cloud** (Supabase) — banco, auth, RLS
- `jsbarcode` (Code 128) + `jspdf` (PDF A4 de etiquetas)
- `recharts` para gráficos do dashboard
- Open Library API para autopreencher por ISBN

## Modelo de Dados

Migration única com tabelas em `public`, RLS habilitada e GRANTs explícitos.

- `app_role` enum (`admin`, `bibliotecario`, `membro`)
- `user_roles` (id, user_id FK→auth.users, role) + função `has_role()` SECURITY DEFINER
- `profiles` (id FK→auth.users, nome, telefone, endereco, data_cadastro)
- `categories` (id, nome, descricao)
- `books` (id, titulo, autor, isbn, editora, ano, numero_paginas, idioma, sinopse, capa_url, quantidade_total, quantidade_disponivel, localizacao_prateleira, categoria_id, timestamps)
- `loans` (id, book_id, user_id, data_emprestimo, data_devolucao_prevista, data_devolucao_real, status)
- `reservations` (id, book_id, user_id, data_reserva, status) — **somente schema, sem UI nesta entrega**
- `labels` (id, book_id, codigo_barras unique, data_geracao)
- `settings` (key, value jsonb) — guarda configurações globais (ex: `multa_por_dia`)

**Trigger** `handle_new_user`: cria `profiles` e atribui role `membro` no signup.

**Primeiro admin (bootstrap):** tela "Tornar-me administrador" visível apenas enquanto não existir nenhum registro com role `admin` na tabela `user_roles`. Botão chama server function que verifica a ausência de admin e promove o usuário autenticado atual. Após existir um admin, a tela some.

**RLS resumida:**
- `books`, `categories`: SELECT público; INSERT/UPDATE/DELETE só admin/bibliotecario.
- `loans`: membro vê os próprios; admin/bibliotecario veem e gerenciam todos.
- `profiles`: usuário edita o próprio; admin/bibliotecario veem todos.
- `user_roles`: só admin gerencia.
- `settings`: leitura autenticada; escrita só admin.

## Telas / Rotas

Públicas:
- `/auth` — login + cadastro (novos usuários viram `membro`)
- `/catalog` — grid com busca por texto, filtros (categoria, disponibilidade), página de detalhe do livro

Autenticadas (`src/routes/_authenticated/`):
- `/dashboard` — cards (total livros, emprestados, membros, atrasados) + gráfico — admin/bibliotecario
- `/books` — DataTable CRUD acervo + **Importar por ISBN**
- `/users` — DataTable usuários + alteração de role — admin/bibliotecario
- `/loans` — empréstimos ativos, registrar devolução (calcula multa), novo empréstimo (autocomplete usuário + livro)
- `/labels` — selecionar livro + faixa numérica → preview 3×8 A4 + exportar PDF
- `/settings` — configurar **valor da multa por dia (R$)** e outros parâmetros globais — admin
- `/profile` — dados pessoais + histórico próprio — todos os papéis

Layout com Sidebar shadcn colapsável; itens filtrados por role.

## Regras de Negócio

- **Empréstimo**: requer `quantidade_disponivel > 0`; RPC atômica decrementa estoque, cria `loans` com `data_devolucao_prevista = hoje + 14 dias`, status `ativo`.
- **Devolução**: RPC atômica incrementa estoque, seta `data_devolucao_real`, status `concluido`. Multa = `dias_de_atraso × settings.multa_por_dia` (configurável; padrão R$ 1,00).
- **Atrasado**: derivado em leitura quando `status='ativo'` e `data_devolucao_prevista < hoje`.
- **ISBN**: server function consulta Open Library e devolve campos para o formulário.
- **Etiquetas**: cada etiqueta tem Título, Autor, código de barras (`{ISBN}-{seq zero-padded}`) e prateleira; registros persistidos em `labels`.

## Server Functions (`requireSupabaseAuth` quando aplicável)
- `bootstrapFirstAdmin` — promove o primeiro admin se não houver nenhum
- `createLoan`, `returnLoan` — via RPCs atômicas
- `importBookByIsbn` — proxy Open Library
- `dashboardStats`
- `generateLabels` — cria registros e devolve dados para o PDF
- `getSettings` / `updateSettings`

## Design

- Paleta confiável: azul marinho `primary`, cinza neutro, branco — tokens `oklch` em `src/styles.css`
- Cantos arredondados (`--radius: 0.75rem`), sombras suaves
- Fonte: Inter (corpo) + display sutil para títulos
- Tabelas com ordenação, filtro e paginação (TanStack Table)
- Toasts via `sonner`; mensagens em pt-BR
- 100% responsivo (mobile, tablet, desktop)

## Entregáveis nesta geração
1. Habilitar Lovable Cloud
2. Migration única (enum, tabelas, RLS, GRANTs, trigger, RPCs, settings com seed `multa_por_dia=1.00`, categorias padrão)
3. Sidebar + roteamento por role + bootstrap de primeiro admin
4. Todas as telas listadas, funcionais
5. Importação ISBN + geração e exportação de etiquetas PDF
