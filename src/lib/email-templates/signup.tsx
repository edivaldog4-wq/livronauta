import * as React from 'react'

import { Link, Text } from '@react-email/components'
import { EmailLayout, emailLink, emailText } from './email-layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <EmailLayout
    preview={`Confirme seu e-mail para acessar o ${siteName}`}
    title="Confirme seu e-mail"
    actionLabel="Confirmar meu e-mail"
    actionUrl={confirmationUrl}
    footer="Se você não criou esta conta, ignore esta mensagem com segurança."
  >
        <Text style={emailText}>
          Obrigado por criar sua biblioteca no{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={emailText}>
          Confirme o endereço{' '}
          <Link href={`mailto:${recipient}`} style={emailLink}>
            {recipient}
          </Link>{' '}
          para ativar sua conta e começar a organizar seus livros.
        </Text>
  </EmailLayout>
)

export default SignupEmail

const link = { ...emailLink, fontWeight: '700' as const }
