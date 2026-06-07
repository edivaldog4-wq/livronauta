# Plano de melhorias

## 1. Banco de dados (migração única)
- `settings`: inserir chave `library_name` (default "Minha Biblioteca").
- `shelves` (nova tabela): `id`, `nome` (unique), `descricao`, timestamps. RLS: leitura authenticated, escrita admin/bibliotecário. GRANTs completos.
- `profiles`: nova coluna `numero` text único (5 dígitos). Função `generate_profile_number()` gera valor aleatório não colidente. Trigger `handle_new_user` passa a inserir o número. Backfill para perfis existentes.
- `categories`: seed com lista ampla brasileira (Literatura Brasileira, Literatura Estrangeira, Romance, Conto, Poesia, Crônica, Infantil, Juvenil, HQ/Mangá, Biografia, História, Filosofia, Sociologia, Psicologia, Religião/Espiritualidade, Autoajuda, Educação, Direito, Administração, Economia, Negócios, Marketing, Tecnologia/Informática, Engenharia, Ciências Exatas, Ciências Biológicas, Saúde/Medicina, Artes, Música, Arquitetura, Gastronomia, Esportes, Viagem, Política, Atualidades, Dicionários/Referência, Didáticos, Concursos, ENEM/Vestibular, Ficção Científica, Fantasia, Suspense/Mistério, Terror).
- `books`: opcional adicionar `codigo_barras` text (independente do ISBN) — busca aceita ambos.

## 2. Frontend — mudanças por funcionalidade

### (1) Nome da biblioteca
- `settings.tsx`: campo "Nome da biblioteca" (lê/grava `library_name` em `settings`).
- `AppSidebar.tsx` e `dashboard.tsx`: lê `library_name` via React Query e exibe no topo/título.

### (2) Etiquetas em lote multi-livro
- `labels.tsx` reformulado: lista de itens `{book_id, quantidade}` com botão "Adicionar livro". Cada linha tem select de livro + input quantidade. Botão "Gerar" produz preview grid 3×8 + PDF concatenado, otimizando aproveitamento da folha A4 (preenche célula a célula sem espaços em branco entre livros diferentes).

### (3) Gestão de estantes em Configurações
- `settings.tsx` ganha seção "Estantes" com tabela CRUD (criar, renomear, excluir). 
- `books.tsx`: o campo "Prateleira" vira `Select` populado a partir de `shelves` (com opção "— Nenhuma —").

### (4) Categorias amplas BR
- Seed na migração. Sem mudança extra na UI.

### (5) Busca por código de barras na Open Library
- `openlibrary.functions.ts`: aceita string genérica. Se 13 dígitos começa com 978/979 → ISBN direto. Caso contrário tenta como ISBN mesmo (códigos EAN de livros normalmente são o próprio ISBN-13). Adiciona fallback `?bibkeys=ISBN:` removendo zeros à esquerda.
- `books.tsx`: rótulo do botão muda para "Buscar por ISBN/Cód. barras".

### (6) Capa no acervo (tabela)
- `books.tsx`: nova coluna "Capa" mostrando `<img>` 40×56 com fallback ícone.

### (7) Histórico global + comprovante A6
- `dashboard.tsx` (apenas staff): nova seção "Histórico de empréstimos" — tabela paginada com livro, usuário, datas, status, multa.
- `loans.tsx`: ao registrar novo empréstimo, abre modal com "Imprimir comprovante" — gera PDF A6 via `jsPDF` (`format: 'a6'`) com nome da biblioteca, código do empréstimo, livro, autor, ISBN, mutuário (nome + número), data empréstimo, data devolução prevista, multa/dia vigente.

### (8) Número de 5 dígitos por perfil
- Gerado pelo trigger e visível em `profile.tsx`, `users.tsx` (coluna), e no comprovante de empréstimo.
- Bootstrap: backfill atribui número aos perfis existentes.

### (9) Leitor de QR/código de barras
- Adicionar dep `html5-qrcode`.
- `books.tsx`: botão "Escanear" abre `Dialog` com câmera; ao detectar código preenche o campo ISBN e dispara busca automática.

### (10) Estatísticas no acervo (catálogo)
- `catalog.tsx`: faixa superior com cards numéricos (Total de livros, Exemplares disponíveis, Categorias, Autores únicos) + mini gráfico de barras (recharts) "Livros por categoria" (top 8).

## 3. Dependências novas
- `html5-qrcode` para leitor.
- Já temos `jspdf`, `jsbarcode`, `recharts`.

## 4. Itens explicitamente fora do escopo
- Não mexer em RLS já existente além do necessário para `shelves`.
- Reservas continuam sem UI.

## Resumo técnico
- 1 migração SQL (settings seed, shelves, profiles.numero + trigger, seed categorias).
- Edições: `settings.tsx`, `dashboard.tsx`, `AppSidebar.tsx`, `labels.tsx`, `books.tsx`, `loans.tsx`, `catalog.tsx`, `profile.tsx`, `users.tsx`, `openlibrary.functions.ts`.
- Novos componentes: `BarcodeScanner.tsx`, `LoanReceipt.ts` (helper jsPDF).
