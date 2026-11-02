import { z } from 'zod';

export const serviceStatusSchema = z.enum(['up', 'down']);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
  services: z.object({
    postgres: z.object({
      status: serviceStatusSchema,
      postgis: z.string().nullable(),
      latencyMs: z.number().nullable(),
    }),
    redis: z.object({
      status: serviceStatusSchema,
      latencyMs: z.number().nullable(),
    }),
  }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
