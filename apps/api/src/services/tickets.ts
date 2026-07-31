import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ticket } from '@event-platform/shared';

// ============================================
// CREATE TICKET
// ============================================

export const createTicket = async (
  eventId: string,
  data: {
    name: string;
    description?: string;
    price: number;
    quantity: number;
    sale_start_at?: string;
    sale_end_at?: string;
  },
  supabase: SupabaseClient
): Promise<Ticket> => {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      event_id: eventId,
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      quantity: data.quantity,
      sold_count: 0,
      starts_at: data.sale_start_at ?? null,
      ends_at: data.sale_end_at ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create ticket: ${error.message}`);
  }

  return ticket as Ticket;
};

// ============================================
// UPDATE TICKET
// ============================================

export const updateTicket = async (
  ticketId: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    quantity?: number;
    sale_start_at?: string;
    sale_end_at?: string;
    is_active?: boolean;
  },
  supabase: SupabaseClient
): Promise<Ticket> => {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.quantity !== undefined) updateData.quantity = data.quantity;
  if (data.sale_start_at !== undefined) updateData.starts_at = data.sale_start_at;
  if (data.sale_end_at !== undefined) updateData.ends_at = data.sale_end_at;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const { data: ticket, error } = await supabase
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update ticket: ${error.message}`);
  }

  return ticket as Ticket;
};

// ============================================
// DELETE TICKET
// ============================================

export const deleteTicket = async (
  ticketId: string,
  supabase: SupabaseClient
): Promise<void> => {
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', ticketId);

  if (error) {
    throw new Error(`Failed to delete ticket: ${error.message}`);
  }
};

// ============================================
// GET EVENT TICKETS
// ============================================

export const getEventTickets = async (
  eventId: string,
  supabase: SupabaseClient
): Promise<Ticket[]> => {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('event_id', eventId)
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (error) {
    throw new Error(`Failed to get tickets: ${error.message}`);
  }

  return (data ?? []) as Ticket[];
};

// ============================================
// INCREMENT SOLD COUNT
// ============================================

export const incrementSoldCount = async (
  ticketId: string,
  supabase: SupabaseClient
): Promise<void> => {
  // Use RPC for atomic increment if available, otherwise do read-then-write
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('sold_count')
    .eq('id', ticketId)
    .single();

  if (error || !ticket) {
    throw new Error('Ticket not found');
  }

  const { error: updateError } = await supabase
    .from('tickets')
    .update({ sold_count: ticket.sold_count + 1, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (updateError) {
    throw new Error(`Failed to increment sold count: ${updateError.message}`);
  }
};
