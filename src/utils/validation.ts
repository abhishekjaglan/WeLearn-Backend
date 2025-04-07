import { z } from 'zod';

export const exampleSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
