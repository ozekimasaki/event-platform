import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// CHAT MESSAGE TYPE
// ============================================

export interface ChatMessage {
  id: string;
  event_id: string;
  user_id: string;
  user_name: string;
  body: string;
  created_at: string;
}

// ============================================
// GET CHAT HISTORY (with pagination)
// ============================================

export const getChatHistory = async (
  eventId: string,
  limit: number = 50,
  before?: string,
  supabase?: SupabaseClient
): Promise<ChatMessage[]> => {
  if (!supabase) {
    throw new Error('Supabase client is required');
  }

  let qb = supabase
    .from('chat_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    qb = qb.lt('created_at', before);
  }

  const { data, error } = await qb;

  if (error) {
    throw new Error(`Failed to get chat history: ${error.message}`);
  }

  return (data ?? []) as ChatMessage[];
};

// ============================================
// SAVE CHAT MESSAGE
// ============================================

export const saveChatMessage = async (
  eventId: string,
  userId: string,
  userName: string,
  body: string,
  supabase: SupabaseClient
): Promise<ChatMessage> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      event_id: eventId,
      user_id: userId,
      user_name: userName,
      body,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save chat message: ${error.message}`);
  }

  return data as ChatMessage;
};
