import PostalMime from 'postal-mime';

/**
 * Email Router Worker
 * Handles inbound emails, parses them, and routes to appropriate processing
 */
export interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: ArrayBuffer;
  }>;
}

interface Env {
  EMAIL_ROUTING_KV: KVNamespace;
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      // Read the raw email
      const rawEmail = await new Response(message.raw).arrayBuffer();

      // Parse with PostalMime
      const parser = new PostalMime();
      const parsed = await parser.parse(rawEmail);

      const emailData: ParsedEmail = {
        from: parsed.from?.address || message.from,
        to: message.to,
        subject: parsed.subject || '',
        text: parsed.text,
        html: parsed.html,
        attachments: parsed.attachments?.map((att) => ({
          filename: att.filename ?? 'attachment',
          contentType: att.mimeType,
          content: att.content instanceof ArrayBuffer ? att.content : new Uint8Array(att.content as Uint8Array).buffer,
        })),
      };

      // Route based on recipient address
      const toAddress = message.to.toLowerCase();

      if (toAddress.startsWith('support@')) {
        await routeToSupport(emailData, env);
      } else if (toAddress.startsWith('organizer@')) {
        await routeToOrganizer(emailData, env);
      } else {
        console.log(`Unrouted email to: ${toAddress}`);
      }
    } catch (error) {
      console.error('Error processing inbound email:', error);
      throw error;
    }
  },
};

async function routeToSupport(email: ParsedEmail, env: Env): Promise<void> {
  // Store support ticket email for processing
  await env.EMAIL_ROUTING_KV.put(
    `support-ticket:${Date.now()}:${email.from}`,
    JSON.stringify(email),
    { expirationTtl: 86400 } // 24 hours
  );
  console.log(`Support email routed from: ${email.from}`);
}

async function routeToOrganizer(email: ParsedEmail, env: Env): Promise<void> {
  // Store organizer email for processing
  await env.EMAIL_ROUTING_KV.put(
    `organizer-email:${Date.now()}:${email.from}`,
    JSON.stringify(email),
    { expirationTtl: 86400 }
  );
  console.log(`Organizer email routed from: ${email.from}`);
}
