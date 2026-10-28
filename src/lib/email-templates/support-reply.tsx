import * as React from 'react'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

function SupportReply({ name, reference, body }: { name?: string | null; reference?: string; body?: string }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>The My Race Engineer team has replied to your support message.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>MY RACE ENGINEER</Text>
          <Heading style={heading}>A reply from our support team</Heading>
          <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
          <Text style={{ ...text, whiteSpace: 'pre-wrap' }}>{body || 'Please contact our support team for more information.'}</Text>
          <Text style={text}>Reply to this email if you need to add anything.</Text>
          {reference && <Text style={small}>Message reference: {reference}</Text>}
          <Text style={small}><Link href="mailto:support@myraceengineer.app" style={brand}>support@myraceengineer.app</Link></Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupportReply,
  subject: 'A reply to your support message | My Race Engineer',
  displayName: 'Support team reply',
  previewData: { name: 'Alex Driver', reference: 'example-message-reference', body: 'Thanks for letting us know. Your session is now ready to use.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const brand = { color: '#1a3a5c', fontSize: '12px', fontWeight: 'bold' as const }
const heading = { color: '#1a3a5c', fontSize: '24px', margin: '20px 0' }
const text = { color: '#242830', fontSize: '15px', lineHeight: '1.6' }
const small = { color: '#55575d', fontSize: '12px', lineHeight: '1.6' }