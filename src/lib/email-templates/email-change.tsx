import * as React from 'react'

import { Link, Text } from '@react-email/components'
import { EmailLayout, emailLink, emailText } from './email-layout'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <EmailLayout
    preview={`Confirme a alteração do seu e-mail no ${siteName}`}
    title="Confirme seu novo e-mail"
    actionLabel="Confirmar alteração"
    actionUrl={confirmationUrl}
    footer="Se você não solicitou esta mudança, proteja sua conta e altere sua senha imediatamente."
  >
        <Text style={emailText}>
          Você solicitou a alteração do e-mail da sua conta no {siteName}, de{' '}
          <Link href={`mailto:${oldEmail}`} style={emailLink}>
            {oldEmail}
          </Link>{' '}
          para{' '}
          <Link href={`mailto:${newEmail}`} style={emailLink}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={emailText}>Use o botão abaixo para confirmar a alteração.</Text>
  </EmailLayout>
)

export default EmailChangeEmail

