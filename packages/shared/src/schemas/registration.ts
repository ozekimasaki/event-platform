import { z } from 'zod';

export const registrationSchema = z.object({
  ticket_id: z.string().uuid().optional(),
  custom_fields: z.record(z.unknown()).optional(),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
