import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailLayout, emailText } from './email-layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <EmailLayout
    preview={`Redefina sua senha do ${siteName}`}
    title="Redefina sua senha"
    actionLabel="Criar nova senha"
    actionUrl={confirmationUrl}
    footer="Se você não pediu a redefinição, ignore esta mensagem. Sua senha não será alterada."
  >
    <Text style={emailText}>Recebemos um pedido para redefinir sua senha do {siteName}. Use o botão abaixo para escolher uma nova senha.</Text>
  </EmailLayout>
)

export default RecoveryEmail

