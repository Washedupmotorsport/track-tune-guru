import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface SupportMessageEmailProps {
  siteName: string
  siteUrl: string
  senderEmail: string
  senderName?: string | null
  category: string
  message: string
  createdAt: string
}

export const SupportMessageEmail = ({
  siteName,
  siteUrl,
  senderEmail,
  senderName,
  category,
  message,
  createdAt,
}: SupportMessageEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>New support message from {senderEmail}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New support message</Heading>
        <Text style={meta}>
          <strong>From:</strong>{' '}
          <Link href={`mailto:${senderEmail}`} style={link}>
            {senderEmail}
          </Link>
          {senderName ? ` (${senderName})` : ''}
        </Text>
        <Text style={meta}>
          <strong>Topic:</strong> {category}
        </Text>
        <Text style={meta}>
          <strong>Received:</strong> {createdAt}
        </Text>
        <Text style={messageBox}>{message}</Text>
        <Text style={footer}>
          Reply directly to this email, or open the inbox at{' '}
          <Link href={`${siteUrl}/support-inbox`} style={link}>
            {siteUrl}/support-inbox
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SupportMessageEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const meta = {
  fontSize: '13px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 8px',
}
const messageBox = {
  fontSize: '14px',
  color: '#000000',
  lineHeight: '1.6',
  margin: '18px 0 20px',
  padding: '14px 16px',
  border: '1px solid #d0d3d9',
  borderRadius: '8px',
  whiteSpace: 'pre-wrap' as const,
}
const link = { color: 'inherit', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    body { background-color: #000000 !important; }
  }
`
