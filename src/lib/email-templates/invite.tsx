import * as React from 'react'

import { Link, Text } from '@react-email/components'
import { EmailLayout, emailLink, emailText } from './email-layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <EmailLayout
    preview={`Você recebeu um convite para o ${siteName}`}
    title="Você recebeu um convite"
    actionLabel="Aceitar convite"
    actionUrl={confirmationUrl}
    footer="Se você não esperava este convite, ignore esta mensagem com segurança."
  >
        <Text style={emailText}>
          Você foi convidado para participar do{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          . Aceite o convite para criar sua conta e acessar a biblioteca compartilhada.
        </Text>
  </EmailLayout>
)

export default InviteEmail

const link = { ...emailLink, fontWeight: '700' as const }
