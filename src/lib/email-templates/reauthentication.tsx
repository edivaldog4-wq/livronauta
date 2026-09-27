import * as React from 'react'

import { Text } from '@react-email/components'
import { EmailLayout, emailCode, emailText } from './email-layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <EmailLayout
    preview="Seu código de verificação do Livronauta"
    title="Confirme sua identidade"
    footer="Este código expira em breve. Se você não fez esta solicitação, ignore esta mensagem."
  >
    <Text style={emailText}>Use o código abaixo para confirmar sua identidade:</Text>
    <Text style={emailCode}>{token}</Text>
  </EmailLayout>
)

export default ReauthenticationEmail

