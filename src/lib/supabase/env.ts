import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  VMS_API_KEY: z.string().min(10).optional(),
  VMS_HOME_VENUE_ID: z.coerce.number().int().positive().optional(),
  VMS_VENUE_TIMEZONE: z.string().min(1).optional(),
  CONTENTFUL_SPACE_ID: z.string().min(1).optional(),
  CONTENTFUL_DELIVERY_TOKEN: z.string().min(1).optional(),
  CONTENTFUL_ENVIRONMENT: z.string().min(1).optional(),
  CONTENTFUL_CONTENT_TYPE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_TITLE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_SLUG: z.string().min(1).optional(),
  CONTENTFUL_FIELD_EXCERPT: z.string().min(1).optional(),
  CONTENTFUL_FIELD_COVER_IMAGE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_BODY: z.string().min(1).optional(),
  CONTENTFUL_FIELD_TAGS: z.string().min(1).optional()
});

type Env = z.infer<typeof envSchema>;

function readEnv(): Env {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    VMS_API_KEY: process.env.VMS_API_KEY,
    VMS_HOME_VENUE_ID: process.env.VMS_HOME_VENUE_ID,
    VMS_VENUE_TIMEZONE: process.env.VMS_VENUE_TIMEZONE,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
    CONTENTFUL_DELIVERY_TOKEN: process.env.CONTENTFUL_DELIVERY_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT,
    CONTENTFUL_CONTENT_TYPE: process.env.CONTENTFUL_CONTENT_TYPE,
    CONTENTFUL_FIELD_TITLE: process.env.CONTENTFUL_FIELD_TITLE,
    CONTENTFUL_FIELD_SLUG: process.env.CONTENTFUL_FIELD_SLUG,
    CONTENTFUL_FIELD_EXCERPT: process.env.CONTENTFUL_FIELD_EXCERPT,
    CONTENTFUL_FIELD_COVER_IMAGE: process.env.CONTENTFUL_FIELD_COVER_IMAGE,
    CONTENTFUL_FIELD_BODY: process.env.CONTENTFUL_FIELD_BODY,
    CONTENTFUL_FIELD_TAGS: process.env.CONTENTFUL_FIELD_TAGS
  });
}

export const env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return readEnv()[prop];
  }
});
