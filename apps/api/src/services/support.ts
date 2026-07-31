import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupportTicket, TicketMessage, TicketDetail, FAQ, TicketStatus } from '@event-platform/shared';

// ============================================
// CREATE SUPPORT TICKET
// ============================================

export const createSupportTicket = async (
  eventId: string,
  userId: string,
  subject: string,
  message: string,
  supabase: SupabaseClient
): Promise<SupportTicket> => {
  // Create ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .insert({
      event_id: eventId,
      user_id: userId,
      subject,
      status: 'open',
    })
    .select()
    .single();

  if (ticketError) {
    throw new Error(`Failed to create ticket: ${ticketError.message}`);
  }

  // Create initial message
  const { error: msgError } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: (ticket as SupportTicket).id,
      user_id: userId,
      body: message,
      is_staff: false,
    });

  if (msgError) {
    throw new Error(`Failed to create message: ${msgError.message}`);
  }

  return ticket as SupportTicket;
};

// ============================================
// REPLY TO TICKET
// ============================================

export const replyToTicket = async (
  ticketId: string,
  userId: string,
  message: string,
  isStaff: boolean,
  supabase: SupabaseClient
): Promise<TicketMessage> => {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: ticketId,
      user_id: userId,
      body: message,
      is_staff: isStaff,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to reply: ${error.message}`);
  }

  // Update ticket updated_at
  await supabase
    .from('support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  return data as TicketMessage;
};

// ============================================
// UPDATE TICKET STATUS
// ============================================

export const updateTicketStatus = async (
  ticketId: string,
  status: TicketStatus,
  supabase: SupabaseClient
): Promise<SupportTicket> => {
  const { data, error } = await supabase
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update status: ${error.message}`);
  }

  return data as SupportTicket;
};

// ============================================
// GET EVENT TICKETS (for organizer/staff)
// ============================================

export interface GetEventTicketsQuery {
  status?: TicketStatus;
  page?: number;
  limit?: number;
}

export const getEventTickets = async (
  eventId: string,
  query: GetEventTicketsQuery,
  supabase: SupabaseClient
): Promise<{ tickets: SupportTicket[]; total: number }> => {
  const { status, page = 1, limit = 20 } = query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let qb = supabase
    .from('support_tickets')
    .select('*', { count: 'exact' })
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (status) {
    qb = qb.eq('status', status);
  }

  const { data, error, count } = await qb.range(from, to);

  if (error) {
    throw new Error(`Failed to get tickets: ${error.message}`);
  }

  return {
    tickets: (data ?? []) as SupportTicket[],
    total: count ?? 0,
  };
};

// ============================================
// GET USER TICKETS
// ============================================

export const getUserTickets = async (
  userId: string,
  supabase: SupabaseClient
): Promise<SupportTicket[]> => {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get user tickets: ${error.message}`);
  }

  return (data ?? []) as SupportTicket[];
};

// ============================================
// GET TICKET DETAIL
// ============================================

export const getTicketDetail = async (
  ticketId: string,
  supabase: SupabaseClient
): Promise<TicketDetail> => {
  const { data: ticket, error: ticketError } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (ticketError) {
    throw new Error(`Failed to get ticket: ${ticketError.message}`);
  }

  const { data: messages, error: msgError } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (msgError) {
    throw new Error(`Failed to get messages: ${msgError.message}`);
  }

  return {
    ticket: ticket as SupportTicket,
    messages: (messages ?? []) as TicketMessage[],
  };
};

// ============================================
// CREATE FAQ
// ============================================

export const createFAQ = async (
  eventId: string,
  question: string,
  answer: string,
  supabase: SupabaseClient
): Promise<FAQ> => {
  const { data, error } = await supabase
    .from('faqs')
    .insert({
      event_id: eventId,
      question,
      answer,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create FAQ: ${error.message}`);
  }

  return data as FAQ;
};

// ============================================
// GET EVENT FAQs
// ============================================

export const getEventFAQs = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<FAQ[]> => {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get FAQs: ${error.message}`);
  }

  return (data ?? []) as FAQ[];
};
