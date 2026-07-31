import { z } from 'zod';

export const articleStatusEnum = z.enum(['draft', 'published', 'scheduled', 'archived']);

export const seoMetadataSchema = z.object({
  meta_title: z.string().max(200).optional(),
  meta_description: z.string().max(500).optional(),
  og_image_url: z.string().url().optional(),
});

export const createArticleSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().min(1).max(100000),
  excerpt: z.string().max(500).optional(),
  cover_image_url: z.string().url().optional(),
  seo_metadata: seoMetadataSchema.optional(),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  slug: z.string().max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  content: z.string().min(1).max(100000).optional(),
  excerpt: z.string().max(500).optional(),
  cover_image_url: z.string().url().optional(),
  published_at: z.string().datetime().optional().nullable(),
  seo_metadata: seoMetadataSchema.optional(),
});

export const articleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['all', 'draft', 'published', 'scheduled', 'archived']).default('all'),
  search: z.string().max(200).optional(),
  sort: z.enum(['created_at', '-created_at', 'published_at', '-published_at', 'title', '-title']).default('-created_at'),
});

export type ArticleQueryInput = z.infer<typeof articleQuerySchema>;
