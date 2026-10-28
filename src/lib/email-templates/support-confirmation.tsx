import * as React from 'react'
import { Body, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

function SupportConfirmation({ name, reference }: { name?: string | null; reference?: string }) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your support message has reached My Race Engineer.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>MY RACE ENGINEER</Text>
          <Heading style={heading}>We’ve received your message</Heading>
          <Text style={text}>{name ? `Hi ${name},` : 'Hi there,'}</Text>
          <Text style={text}>Thanks for contacting My Race Engineer. Your message is in our Support Inbox, and the team will review it and reply to this email address.</Text>
          <Text style={text}>This is an automatic confirmation, not a reply from the team. If you need to add anything, reply to this email.</Text>
          {reference && <Text style={small}>Message reference: {reference}</Text>}
          <Text style={small}><Link href="mailto:support@myraceengineer.app" style={link}>support@myraceengineer.app</Link></Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupportConfirmation,
  subject: 'We received your message | My Race Engineer',
  displayName: 'Support message confirmation',
  previewData: { name: 'Alex Driver', reference: 'example-message-reference' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const brand = { color: '#1a3a5c', fontSize: '12px', fontWeight: 'bold' as const }
const heading = { color: '#1a3a5c', fontSize: '24px', margin: '20px 0' }
const text = { color: '#242830', fontSize: '15px', lineHeight: '1.6' }
const small = { color: '#55575d', fontSize: '12px', lineHeight: '1.6' }
const link = { color: '#1a3a5c', textDecoration: 'underline' }