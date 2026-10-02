# Prazo configurável e leitura de etiquetas

## Resultado
- Incluir nas Configurações um prazo padrão de empréstimo, em dias, com valor inicial de 14 dias.
- Aplicar esse prazo a empréstimos novos, empréstimos rápidos e aprovações de solicitações.
- Corrigir a leitura das etiquetas já geradas e das novas, tanto por código de barras quanto por QR Code.

## Implementação
1. Salvar `prazo_emprestimo_dias` nas configurações de cada biblioteca, limitado a 1–90 dias.
2. Fazer o banco usar esse prazo como fonte definitiva ao criar ou aprovar um empréstimo, mantendo 14 dias como fallback.
3. Atualizar telas e comprovantes para exibirem e usarem o prazo configurado, sem valores fixos.
4. Unificar a normalização do código no gerador e no leitor, aceitando etiquetas com ou sem hífen e ISBN digitado.
5. Permitir a digitação dos códigos internos completos e manter compatibilidade com etiquetas antigas já impressas.
6. Validar o fluxo completo: gerar/localizar etiqueta, selecionar usuário, registrar empréstimo e conferir a data prevista.

## Detalhes técnicos
- A causa confirmada é a diferença entre o código salvo (`ISBN-0001`) e o código entregue pelo leitor (`ISBN0001`).
- A busca continuará restrita à biblioteca ativa e retornará somente livros disponíveis.
- A alteração do prazo afetará apenas novos empréstimos; empréstimos existentes conservarão suas datas.