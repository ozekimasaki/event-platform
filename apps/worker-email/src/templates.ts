/**
 * KV-based Email Template System
 * Templates stored in KV as JSON: { html, text, subject, variables[] }
 * Supports {{variable}} placeholder substitution
 */

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
  category: 'transactional' | 'marketing' | 'notification';
  created_at: string;
  updated_at: string;
}

// ============================================
// TEMPLATE RENDERER
// ============================================

/**
 * Replace {{variable}} placeholders with actual values
 */
export function renderTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

/**
 * Render both HTML and text templates with the same data
 */
export function renderEmailTemplate(
  html: string,
  text: string,
  data: Record<string, string>
): { html: string; text: string } {
  return {
    html: renderTemplate(html, data),
    text: renderTemplate(text, data),
  };
}

// ============================================
// KV TEMPLATE OPERATIONS
// ============================================

/**
 * Get a template from KV by ID
 */
export async function getTemplate(kv: KVNamespace, templateId: string): Promise<EmailTemplate | null> {
  const raw = await kv.get(`template:${templateId}`, 'json');
  if (!raw) return null;
  return raw as EmailTemplate;
}

/**
 * Save a template to KV
 */
export async function saveTemplate(kv: KVNamespace, template: EmailTemplate): Promise<void> {
  await kv.put(`template:${template.id}`, JSON.stringify(template));
  // Also maintain an index of all template IDs
  const indexRaw = await kv.get('template-index', 'json');
  const index = (indexRaw as string[]) || [];
  if (!index.includes(template.id)) {
    index.push(template.id);
    await kv.put('template-index', JSON.stringify(index));
  }
}

/**
 * Delete a template from KV
 */
export async function deleteTemplate(kv: KVNamespace, templateId: string): Promise<void> {
  await kv.delete(`template:${templateId}`);
  const indexRaw = await kv.get('template-index', 'json');
  const index = (indexRaw as string[]) || [];
  const filtered = index.filter((id) => id !== templateId);
  await kv.put('template-index', JSON.stringify(filtered));
}

/**
 * List all template IDs from the index
 */
export async function listTemplateIds(kv: KVNamespace): Promise<string[]> {
  const raw = await kv.get('template-index', 'json');
  return (raw as string[]) || [];
}

/**
 * List all templates (fetches each from KV)
 */
export async function listTemplates(kv: KVNamespace): Promise<EmailTemplate[]> {
  const ids = await listTemplateIds(kv);
  const templates: EmailTemplate[] = [];
  for (const id of ids) {
    const tpl = await getTemplate(kv, id);
    if (tpl) templates.push(tpl);
  }
  return templates;
}

// ============================================
// BUILT-IN TEMPLATE DEFAULTS
// ============================================

export const BUILTIN_TEMPLATE_DEFAULTS: Record<string, Omit<EmailTemplate, 'created_at' | 'updated_at'>> = {
  'registration-confirmation': {
    id: 'registration-confirmation',
    name: '参加登録完了',
    subject: '【{{eventName}}】参加登録が完了しました',
    html: '',
    text: '',
    variables: ['userName', 'eventName', 'eventDate', 'eventVenue', 'ticketType', 'qrCodeUrl'],
    category: 'transactional',
  },
  'reminder': {
    id: 'reminder',
    name: 'イベントリマインダー',
    subject: '【リマインダー】{{eventName}} まもなく開始です',
    html: '',
    text: '',
    variables: ['userName', 'eventName', 'eventDate', 'eventVenue', 'eventUrl'],
    category: 'notification',
  },
  'cancellation': {
    id: 'cancellation',
    name: 'イベントキャンセル通知',
    subject: '【重要】{{eventName}} はキャンセルされました',
    html: '',
    text: '',
    variables: ['userName', 'eventName', 'eventDate', 'reason', 'refundInfo'],
    category: 'notification',
  },
  'checkin-confirmation': {
    id: 'checkin-confirmation',
    name: 'チェックイン完了',
    subject: '【{{eventName}}】チェックインが完了しました',
    html: '',
    text: '',
    variables: ['userName', 'eventName', 'eventDate', 'eventVenue', 'checkinTime'],
    category: 'transactional',
  },
  'marketing-event': {
    id: 'marketing-event',
    name: 'イベント告知',
    subject: '✨ {{eventName}} - 参加者募集中！',
    html: '',
    text: '',
    variables: ['eventName', 'eventDate', 'eventVenue', 'eventUrl', 'eventDescription', 'price'],
    category: 'marketing',
  },
  'newsletter': {
    id: 'newsletter',
    name: 'ニュースレター',
    subject: '{{month}}の最新イベント情報',
    html: '',
    text: '',
    variables: ['month', 'content', 'featuredEvents', 'unsubscribeUrl'],
    category: 'marketing',
  },
  'custom-notification': {
    id: 'custom-notification',
    name: 'カスタム通知',
    subject: '{{subject}}',
    html: '',
    text: '',
    variables: ['userName', 'eventName', 'message', 'subject'],
    category: 'notification',
  },
};
