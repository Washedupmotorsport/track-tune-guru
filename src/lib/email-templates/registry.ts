import type { ComponentType } from 'react'
import { SupportMessageEmail } from './support-message'
import { template as supportConfirmation } from './support-confirmation'
import { template as supportReply } from './support-reply'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'support-reply': supportReply,
  'support-confirmation': supportConfirmation,
  'support-message': {
    component: SupportMessageEmail,
    subject: (data) => `[Support] ${data.category ?? 'other'} — ${data.senderEmail ?? 'new message'}`,
    displayName: 'New support message (team notification)',
    to: 'support@myraceengineer.app',
    previewData: {
      siteName: 'My Race Engineer',
      siteUrl: 'https://myraceengineer.app',
      senderEmail: 'driver@example.com',
      senderName: 'Alex Driver',
      category: 'bug',
      message: 'The lap timer stopped counting on the third lap of my session.',
      createdAt: '2026-10-28 12:20 UTC',
    },
  },
}
