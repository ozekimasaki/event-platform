import { z } from 'zod';

export const uploadMaterialSchema = z.object({
  session_id: z.string().uuid(),
  file_name: z.string().min(1).max(500),
  file_url: z.string().min(1).max(2000),
  file_type: z.enum(['pdf', 'ppt', 'pptx', 'png', 'jpg']),
  access_level: z.enum(['public', 'participants_only']).default('public'),
  description: z.string().max(2000).optional(),
});

export type UploadMaterialInput = z.infer<typeof uploadMaterialSchema>;
