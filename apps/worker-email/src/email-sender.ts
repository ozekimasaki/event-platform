import PostalMime from 'postal-mime';
import {
  registrationConfirmationHtml,
  registrationConfirmationText,
} from './templates/registration-confirmation.js';

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

// Built-in templates registry
const BUILTIN_TEMPLATES: Record<string, { html: string; text: string }> = {
  'registration-confirmation': {
    html: registrationConfirmationHtml,
    text: registrationConfirmationText,
  },
};

// Maximum retry attempts
const MAX_RETRIES = 3;

export default {
  async queue(batch: MessageBatch<EmailJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const email = message.body;
        let html = email.html;
        let text = email.text;

        // Render template if templateId is provided
        if (email.templateId) {
          // First check built-in templates
          const builtinTemplate = BUILTIN_TEMPLATES[email.templateId];
          if (builtinTemplate) {
            html = renderTemplate(builtinTemplate.html, email.templateData || {});
            text = renderTemplate(builtinTemplate.text, email.templateData || {});
          } else {
            // Fall back to KV-stored templates
            const template = await env.EMAIL_TEMPLATES_KV.get(`template:${email.templateId}`);
            if (template) {
              const parsed = JSON.parse(template) as { html: string; text: string };
              html = renderTemplate(parsed.html, email.templateData || {});
              text = renderTemplate(parsed.text, email.templateData || {});
            }
          }
        }

        // Send with retry logic
        let lastError: Error | null = null;
        let sent = false;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const response = await env.SEND_EMAIL.send({
              to: email.to,
              from: email.from,
              subject: email.subject,
              html: html,
              text: text,
            });

            if (response.ok) {
              sent = true;

              // Log success to D1
              await env.EMAIL_LOG_DB.prepare(
                `INSERT INTO email_log (to_email, from_email, subject, status, sent_at)
                 VALUES (?, ?, ?, ?, ?)`
              )
                .bind(
                  email.to,
                  email.from,
                  email.subject,
                  'sent',
                  new Date().toISOString()
                )
                .run();

              break;
            } else {
              lastError = new Error(`Email send failed: ${JSON.stringify(response)}`);
              console.error(`Email send attempt ${attempt}/${MAX_RETRIES} failed:`, response);
            }
          } catch (sendError) {
            lastError = sendError instanceof Error ? sendError : new Error(String(sendError));
            console.error(`Email send attempt ${attempt}/${MAX_RETRIES} error:`, lastError.message);
          }

          // Wait before retry (exponential backoff)
          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }

        // Log final failure to D1
        if (!sent) {
          await env.EMAIL_LOG_DB.prepare(
            `INSERT INTO email_log (to_email, from_email, subject, status, sent_at)
             VALUES (?, ?, ?, ?, ?)`
          )
            .bind(
              email.to,
              email.from,
              email.subject,
              'failed',
              new Date().toISOString()
            )
            .run();

          console.error(`Email permanently failed after ${MAX_RETRIES} attempts:`, lastError?.message);
          message.retry();
        }
      } catch (error) {
        console.error('Error processing email job:', error);
        message.retry();
      }
    }
  },
};

/**
 * Simple template renderer - replaces {{variable}} placeholders with data values
 */
function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}
