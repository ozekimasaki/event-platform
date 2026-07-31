import { z } from 'zod';

export const surveyQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'choice', 'rating', 'multi']),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});

export const createSurveySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  questions: z.array(surveyQuestionSchema).min(1),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  is_active: z.boolean().default(true),
});

export const updateSurveySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  questions: z.array(surveyQuestionSchema).min(1).optional(),
  starts_at: z.string().datetime().optional(),
  ends_at: z.string().datetime().optional(),
  is_active: z.boolean().optional(),
});

export const submitResponseSchema = z.object({
  answers: z.record(z.union([z.string(), z.number(), z.array(z.string())])),
});

export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>;
export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;
