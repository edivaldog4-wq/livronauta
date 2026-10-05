# Administração da plataforma e pixels de anúncios

## Objetivo
Criar uma área exclusiva do fundador para administrar contas e configurações de publicidade, sem ampliar os poderes dos administradores comuns de cada biblioteca.

## O que será construído

### Usuários
- Ampliar a página **Usuários** para o fundador visualizar contas de toda a plataforma e suas bibliotecas.
- Manter a gestão atual de membros da biblioteca para administradores comuns.
- Adicionar ações protegidas para:
  - enviar e-mail de recuperação de senha;
  - trocar o e-mail de acesso de uma conta, com confirmação explícita;
  - conceder ou remover o papel de administrador em uma biblioteca específica;
  - conceder ou revogar gratuidade institucional.
- Exibir confirmações antes de ações sensíveis e impedir que o fundador remova acidentalmente o próprio acesso principal.

### Gratuidade e Asaas
- Registrar a gratuidade como uma exceção própria da biblioteca, com motivo, responsável e data.
- Ao concedê-la, cancelar uma assinatura recorrente existente antes de ativar a exceção, evitando novas cobranças.
- Fazer o webhook do Asaas ignorar alterações de plano para bibliotecas com gratuidade ativa.
- Ao revogar a gratuidade, retornar a biblioteca ao estado de ativação do Pro, sem criar cobrança automaticamente.

### Meta Ads e Google Ads
- Criar uma seção **Rastreamento de anúncios** em Configurações, visível somente ao fundador.
- Aceitar apenas IDs válidos do Meta Pixel e da tag do Google Ads; não permitir scripts livres.
- Carregar as tags oficiais em todas as páginas somente após consentimento do visitante.
- Registrar visualizações de página durante a navegação e oferecer opção para retirar o consentimento.
- Deixar os campos vazios como estado desativado, sem erro para visitantes.

## Segurança e privacidade
- Todas as ações globais serão validadas novamente no servidor como fundador antes de acessar contas ou alterar cobrança.
- Credenciais administrativas nunca irão para o navegador.
- A configuração pública exporá somente os IDs de rastreamento necessários, nunca segredos.
- A interface explicará que os pixels entram em funcionamento após salvar um ID válido e o visitante aceitar cookies de marketing.

## Validação
- Conferir fundador versus administrador comum.
- Testar envio de recuperação, alteração de e-mail, papel administrativo e concessão/revogação da gratuidade.
- Simular eventos do Asaas para confirmar que a gratuidade não é sobrescrita.
- Verificar Meta e Google em desktop e mobile, antes e depois do consentimento, sem duplicar eventos.
