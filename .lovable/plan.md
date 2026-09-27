# Ativar pagamentos Asaas

## O que você faz
1. Publique o site para o endereço de retorno ficar ativo.
2. No painel do Asaas, vá em Integrações > Webhooks e crie um webhook com:
   - **URL:** https://livronauta.lovable.app/api/public/asaas-webhook
   - **Token de autenticação:** uma senha forte que você mesmo cria. Guarde-a, porque vai colar a mesma senha no formulário do passo 3.
   - **Eventos:** pagamento confirmado, recebido, vencido e estornado; assinatura removida ou inativada.
3. No formulário seguro que vou abrir, preencha:
   - a chave de API do Asaas (começa com `$aact_`);
   - o mesmo token criado no passo 2;
   - o ambiente: `sandbox` para testes ou `production` para cobranças reais.

## O que eu faço depois
- Abro o formulário seguro para salvar os três dados.
- Testo o endereço de retorno: sem o token, ele deve recusar a chamada.
- Confirmo que o botão "Fazer upgrade" gera o link de pagamento.

## Detalhes técnicos
- Segredos salvos: `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_ENV`.
- O webhook valida o cabeçalho `asaas-access-token` antes de alterar o plano de qualquer biblioteca.
