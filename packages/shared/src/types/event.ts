// Event Status
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

// Pricing Type
export type PricingType = 'free' | 'paid' | 'donation';

// Event Type
export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  organizer_id: string;
  status: EventStatus;
  pricing_type: PricingType;
  base_price?: number;
  currency: string;
  capacity?: number;
  start_at: string;
  end_at: string;
  venue_name?: string;
  venue_address?: string;
  is_online: boolean;
  online_url?: string;
  cover_image_url?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Ticket Type
export interface Ticket {
  id: string;
  event_id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  sold_count: number;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Registration Status
export type RegistrationStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked_in';

// Registration
export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  ticket_id: string;
  status: RegistrationStatus;
  payment_id?: string;
  checked_in_at?: string;
  checked_in_by?: string;
  created_at: string;
  updated_at: string;
}

// Create Event Input
export interface CreateEventInput {
  title: string;
  description: string;
  pricing_type: PricingType;
  base_price?: number;
  currency?: string;
  capacity?: number;
  start_at: string;
  end_at: string;
  venue_name?: string;
  venue_address?: string;
  is_online?: boolean;
  online_url?: string;
  cover_image_url?: string;
  tags?: string[];
}

// Update Event Input
export interface UpdateEventInput {
  title?: string;
  description?: string;
  status?: EventStatus;
  pricing_type?: PricingType;
  base_price?: number;
  currency?: string;
  capacity?: number;
  start_at?: string;
  end_at?: string;
  venue_name?: string;
  venue_address?: string;
  is_online?: boolean;
  online_url?: string;
  cover_image_url?: string;
  tags?: string[];
}

// Event Query
export interface EventQuery {
  page?: number;
  limit?: number;
  status?: EventStatus;
  search?: string;
  tag?: string;
  sort?: string;
}

// Create Event Request (alias for CreateEventInput)
export type CreateEventRequest = CreateEventInput & { slug?: string };

// Update Event Request (alias for UpdateEventInput)
export type UpdateEventRequest = UpdateEventInput & { slug?: string };

// Event List Query (alias for EventQuery)
export type EventListQuery = EventQuery;

// Event List Response
export interface EventListResponse {
  events: Event[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Upload Response
export interface UploadResponse {
  url: string;
  key: string;
  size: number;
  mimetype: string;
}
