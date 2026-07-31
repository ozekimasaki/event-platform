import type { SupabaseClient } from '@supabase/supabase-js';
import type { Article, ArticleStatus, ArticleListResponse } from '@event-platform/shared';

// ============================================
// SLUG GENERATION
// ============================================

export const generateArticleSlug = (title: string): string => {
  let slug = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);

  if (!slug || /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(title)) {
    const timestamp = Date.now().toString(36);
    slug = `post-${timestamp}`;
  }

  return slug;
};

// ============================================
// COMPUTE ARTICLE STATUS
// ============================================

const computeStatus = (article: Article): ArticleStatus => {
  if (!article.published_at) return 'draft';
  const pubDate = new Date(article.published_at);
  const now = new Date();
  if (pubDate > now) return 'scheduled';
  return 'published';
};

const enrichArticle = (article: Article): Article => {
  return { ...article, status: computeStatus(article) };
};

// ============================================
// LIST ARTICLES
// ============================================

export interface ListArticlesQuery {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sort?: string;
}

export const getArticles = async (
  query: ListArticlesQuery,
  supabase: SupabaseClient,
  organizerId?: string
): Promise<ArticleListResponse> => {
  const { page, limit, status, search, sort } = query;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let qb = supabase
    .from('articles')
    .select('*', { count: 'exact' });

  if (organizerId) {
    qb = qb.eq('organizer_id', organizerId);
  } else {
    // Public listing: only published
    qb = qb.not('published_at', 'is', null);
  }

  // Status filter (for dashboard)
  if (status && status !== 'all' && organizerId) {
    if (status === 'draft') {
      qb = qb.is('published_at', null);
    } else if (status === 'published') {
      qb = qb.not('published_at', 'is', null).lte('published_at', new Date().toISOString());
    } else if (status === 'scheduled') {
      qb = qb.not('published_at', 'is', null).gt('published_at', new Date().toISOString());
    }
  }

  if (search) {
    qb = qb.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
  }

  if (sort) {
    const descending = sort.startsWith('-');
    const column = descending ? sort.substring(1) : sort;
    const validColumns = ['created_at', 'published_at', 'title'];
    if (validColumns.includes(column)) {
      qb = qb.order(column, { ascending: !descending });
    }
  } else {
    qb = qb.order('created_at', { ascending: false });
  }

  const { data, error, count } = await qb.range(from, to);

  if (error) {
    throw new Error(`Failed to list articles: ${error.message}`);
  }

  const articles = ((data ?? []) as Article[]).map(enrichArticle);
  const total = count ?? 0;
  const total_pages = Math.ceil(total / limit);

  return { articles, total, page, limit, total_pages };
};

// ============================================
// GET ARTICLE BY SLUG
// ============================================

export const getArticleBySlug = async (
  slug: string,
  supabase: SupabaseClient
): Promise<Article | null> => {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get article: ${error.message}`);
  }

  return enrichArticle(data as Article);
};

// ============================================
// GET ARTICLE BY ID
// ============================================

export const getArticleById = async (
  id: string,
  supabase: SupabaseClient
): Promise<Article | null> => {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to get article: ${error.message}`);
  }

  return enrichArticle(data as Article);
};

// ============================================
// CREATE ARTICLE
// ============================================

export interface CreateArticleData {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  cover_image_url?: string;
  seo_metadata?: Record<string, unknown>;
}

export const createArticle = async (
  data: CreateArticleData,
  userId: string,
  supabase: SupabaseClient
): Promise<Article> => {
  let slug = data.slug ?? generateArticleSlug(data.title);

  // Ensure slug uniqueness
  const existing = await supabase
    .from('articles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing.data) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const insertData = {
    title: data.title,
    slug,
    content: data.content,
    excerpt: data.excerpt ?? null,
    cover_image_url: data.cover_image_url ?? null,
    organizer_id: userId,
    seo_metadata: data.seo_metadata ?? null,
  };

  const { data: article, error } = await supabase
    .from('articles')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create article: ${error.message}`);
  }

  return enrichArticle(article as Article);
};

// ============================================
// UPDATE ARTICLE
// ============================================

export interface UpdateArticleData {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  cover_image_url?: string;
  published_at?: string | null;
  seo_metadata?: Record<string, unknown>;
}

export const updateArticle = async (
  id: string,
  data: UpdateArticleData,
  userId: string,
  supabase: SupabaseClient
): Promise<Article> => {
  const existing = await getArticleById(id, supabase);
  if (!existing) {
    throw new Error('Article not found');
  }
  if (existing.organizer_id !== userId) {
    throw new Error('Unauthorized: not the article organizer');
  }

  if (data.slug && data.slug !== existing.slug) {
    const slugTaken = await supabase
      .from('articles')
      .select('id')
      .eq('slug', data.slug)
      .neq('id', id)
      .maybeSingle();

    if (slugTaken.data) {
      throw new Error('Slug is already taken');
    }
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
  if (data.cover_image_url !== undefined) updateData.cover_image_url = data.cover_image_url;
  if (data.published_at !== undefined) updateData.published_at = data.published_at;
  if (data.seo_metadata !== undefined) updateData.seo_metadata = data.seo_metadata;

  const { data: article, error } = await supabase
    .from('articles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update article: ${error.message}`);
  }

  return enrichArticle(article as Article);
};

// ============================================
// DELETE ARTICLE
// ============================================

export const deleteArticle = async (
  id: string,
  userId: string,
  supabase: SupabaseClient
): Promise<void> => {
  const existing = await getArticleById(id, supabase);
  if (!existing) {
    throw new Error('Article not found');
  }
  if (existing.organizer_id !== userId) {
    throw new Error('Unauthorized: not the article organizer');
  }

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete article: ${error.message}`);
  }
};
