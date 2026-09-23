# Correções no cadastro móvel e na busca do acervo

## Interface móvel
- Reorganizar as ações do cadastro de livros no celular: “Salvar livro” ficará como ação principal, em largura total e visualmente separada.
- Transformar “Cancelar” em ação secundária menos proeminente e acrescentar espaço seguro entre os botões, reduzindo toques acidentais.
- Impedir que um toque fora da janela feche o cadastro enquanto houver dados preenchidos, preservando o trabalho em andamento.

## Busca sem acentos
- Criar campos de busca normalizados para título e autor, preenchidos automaticamente sem acentos e em letras minúsculas.
- Normalizar também o termo digitado antes da consulta, permitindo, por exemplo, encontrar “Coração” ao buscar “coracao”.
- Manter busca por título, autor e ISBN, paginação e seleção em massa usando exatamente o mesmo filtro.

## Segurança obrigatória
- Restringir explicitamente a leitura das configurações a usuários autenticados, preservando o funcionamento atual.
- Atualizar as dependências afetadas pelo alerta crítico e validar novamente a verificação de segurança.

## Validação
- Conferir o cadastro em largura de celular, incluindo fechamento involuntário e posição das ações.
- Testar buscas equivalentes com e sem acentos e confirmar paginação/contagem.
- Confirmar que a aplicação continua compilando sem erros.
