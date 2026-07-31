import PostalMime from 'postal-mime';

/**
 * Email Sender Worker
 * Queue consumer that processes email jobs and sends emails via CF Email Service
 */
export interface EmailJob {
  to: string;
  from: string;
  subject: string;
  templateId?: string;
  templateData?: Record<string, string>;
  html?: string;
  text?: string;
}

interface Env {
  SEND_EMAIL: SendEmail;
  EMAIL_TEMPLATES_KV: KVNamespace;
  EMAIL_LOG_DB: D1Database;
}

export default {
  async queue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const email = message.body;
        let html = email.html;
        let text = email.text;

        // Render template if templateId is provided
        if (email.templateId) {
          const template = await env.EMAIL_TEMPLATES_KV.get(`template:${email.templateId}`);
          if (template) {
            const parsed = JSON.parse(template) as { html: string; text: string };
            html = renderTemplate(parsed.html, email.templateData || {});
            text = renderTemplate(parsed.text, email.templateData || {});
          }
        }

        // Send email via CF Email Service
        const response = await env.SEND_EMAIL.send({
          to: email.to,
          from: email.from,
          subject: email.subject,
          html: html,
          text: text,
        });

        // Log to D1
        await env.EMAIL_LOG_DB.prepare(
          `INSERT INTO email_log (to_email, from_email, subject, status, sent_at)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(
            email.to,
            email.from,
            email.subject,
            response.ok ? 'sent' : 'failed',
            new Date().toISOString()
          )
          .run();

        if (!response.ok) {
          console.error('Email send failed:', response);
        }
      } catch (error) {
        console.error('Error processing email job:', error);
      }
    }
  },
};

/**
 * Simple template renderer
 */
function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}
