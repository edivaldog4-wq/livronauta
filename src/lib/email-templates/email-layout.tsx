import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'

type EmailLayoutProps = {
  preview: string
  title: string
  children: React.ReactNode
  actionLabel?: string
  actionUrl?: string
  footer: string
}

export function EmailLayout({ preview, title, children, actionLabel, actionUrl, footer }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandBar}>
            <Text style={brand}>LIVRONAUTA</Text>
          </Section>
          <Section style={content}>
            <Heading style={heading}>{title}</Heading>
            {children}
            {actionLabel && actionUrl ? <Button style={button} href={actionUrl}>{actionLabel}</Button> : null}
            <Text style={footerStyle}>{footer}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const emailText = {
  color: '#435064',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 22px',
}

export const emailLink = { color: '#d8690f', textDecoration: 'underline' }

export const emailCode = {
  backgroundColor: '#f2f4f5',
  border: '1px solid #d8dde3',
  borderRadius: '6px',
  color: '#15243a',
  fontFamily: 'Courier New, monospace',
  fontSize: '28px',
  fontWeight: '700' as const,
  letterSpacing: '4px',
  margin: '4px 0 28px',
  padding: '16px 20px',
  textAlign: 'center' as const,
}

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: '0', padding: '28px 12px' }
const container = { border: '1px solid #d8dde3', borderRadius: '8px', maxWidth: '560px', overflow: 'hidden' as const }
const brandBar = { backgroundColor: '#15243a', padding: '20px 28px' }
const brand = { color: '#f59a23', fontSize: '18px', fontWeight: '700' as const, margin: '0' }
const content = { padding: '30px 28px' }
const heading = { color: '#15243a', fontSize: '26px', fontWeight: '700' as const, lineHeight: '34px', margin: '0 0 18px' }
const button = { backgroundColor: '#f59a23', borderRadius: '6px', color: '#15243a', fontSize: '15px', fontWeight: '700' as const, padding: '13px 22px', textDecoration: 'none' }
const footerStyle = { borderTop: '1px solid #e7eaee', color: '#718096', fontSize: '12px', lineHeight: '18px', margin: '30px 0 0', paddingTop: '18px' }