import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailLayout, emailText } from './email-layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <EmailLayout
    preview={`Seu acesso ao ${siteName}`}
    title="Seu link de acesso"
    actionLabel="Entrar no Livronauta"
    actionUrl={confirmationUrl}
    footer="Se você não solicitou este acesso, ignore esta mensagem com segurança."
  >
    <Text style={emailText}>Use o botão abaixo para entrar no {siteName}. Por segurança, este link expira em breve.</Text>
  </EmailLayout>
)

export default MagicLinkEmail

