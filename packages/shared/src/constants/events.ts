export const EVENT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

export const PRICING_TYPE = {
  FREE: 'free',
  PAID: 'paid',
  DONATION: 'donation',
} as const;

export const EVENT_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  published: '公開中',
  cancelled: 'キャンセル',
  completed: '完了',
};

export const PRICING_TYPE_LABELS: Record<string, string> = {
  free: '無料',
  paid: '有料',
  donation: '投げ銭',
};
