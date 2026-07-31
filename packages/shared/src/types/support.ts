// Ticket Status
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// Support Ticket
export interface SupportTicket {
  id: string;
  event_id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

// Ticket Message
export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
}

// FAQ
export interface FAQ {
  id: string;
  event_id: string;
  question: string;
  answer: string;
  created_at: string;
  updated_at: string;
}

// Ticket Detail (ticket + messages)
export interface TicketDetail {
  ticket: SupportTicket;
  messages: TicketMessage[];
}

// Create Ticket Request
export interface CreateTicketRequest {
  subject: string;
  message: string;
}

// Reply Request
export interface ReplyRequest {
  message: string;
}

// FAQ Create Request
export interface CreateFAQRequest {
  question: string;
  answer: string;
}
