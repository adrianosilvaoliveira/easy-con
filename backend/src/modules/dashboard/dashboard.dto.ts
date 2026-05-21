import { z } from 'zod';

export const chartPeriodSchema = z.enum(['day', 'week', 'month', 'semester', 'year']);

export type ChartPeriod = z.infer<typeof chartPeriodSchema>;
