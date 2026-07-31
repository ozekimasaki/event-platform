// Article Status (computed from published_at)
export type ArticleStatus = 'draft' | 'published' | 'scheduled' | 'archived';

// Article
export interface Article {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  cover_image_url?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  // Computed field (not stored in DB)
  status?: ArticleStatus;
  // SEO fields (stored in seo_metadata JSON column if available)
  seo_metadata?: {
    meta_title?: string;
    meta_description?: string;
    og_image_url?: string;
  };
  // Author info (joined from profiles/organizers)
  author_name?: string;
}

// Create Article Request
export interface CreateArticleRequest {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  cover_image_url?: string;
  seo_metadata?: {
    meta_title?: string;
    meta_description?: string;
    og_image_url?: string;
  };
}

// Update Article Request
export interface UpdateArticleRequest {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  cover_image_url?: string;
  seo_metadata?: {
    meta_title?: string;
    meta_description?: string;
    og_image_url?: string;
  };
}

// Article List Query
export interface ArticleListQuery {
  page?: number;
  limit?: number;
  status?: ArticleStatus;
  organizer_id?: string;
  search?: string;
}

// Article List Response
export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}
