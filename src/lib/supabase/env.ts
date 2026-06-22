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
  CONTENTFUL_ACCESS_TOKEN: z.string().min(1).optional(),
  CONTENTFUL_ENVIRONMENT: z.string().min(1).optional(),
  CONTENTFUL_CONTENT_TYPE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_TITLE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_SLUG: z.string().min(1).optional(),
  CONTENTFUL_FIELD_EXCERPT: z.string().min(1).optional(),
  CONTENTFUL_FIELD_COVER_IMAGE: z.string().min(1).optional(),
  CONTENTFUL_FIELD_BODY: z.string().min(1).optional(),
  CONTENTFUL_FIELD_TAGS: z.string().min(1).optional(),
  CONTENTFUL_FIELD_DATE: z.string().min(1).optional(),
  TOAST_API_BASE_URL: z.string().url().optional(),
  TOAST_CLIENT_ID: z.string().min(1).optional(),
  TOAST_CLIENT_SECRET: z.string().min(1).optional(),
  TOAST_RESTAURANT_GUID: z.string().min(1).optional(),
  TOAST_WEBHOOK_SECRET: z.string().min(1).optional(),
  TOAST_RACING_ITEM_GUIDS: z.string().min(1).optional(),
  TOAST_RACING_CATEGORY_GUIDS: z.string().min(1).optional(),
  TOAST_DEFAULT_SESSION_MINUTES: z.coerce.number().int().positive().optional(),
  TOAST_DEFAULT_SESSION_PODS: z.coerce.number().int().positive().optional()
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
    CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT,
    CONTENTFUL_CONTENT_TYPE: process.env.CONTENTFUL_CONTENT_TYPE,
    CONTENTFUL_FIELD_TITLE: process.env.CONTENTFUL_FIELD_TITLE,
    CONTENTFUL_FIELD_SLUG: process.env.CONTENTFUL_FIELD_SLUG,
    CONTENTFUL_FIELD_EXCERPT: process.env.CONTENTFUL_FIELD_EXCERPT,
    CONTENTFUL_FIELD_COVER_IMAGE: process.env.CONTENTFUL_FIELD_COVER_IMAGE,
    CONTENTFUL_FIELD_BODY: process.env.CONTENTFUL_FIELD_BODY,
    CONTENTFUL_FIELD_TAGS: process.env.CONTENTFUL_FIELD_TAGS,
    CONTENTFUL_FIELD_DATE: process.env.CONTENTFUL_FIELD_DATE,
    TOAST_API_BASE_URL: process.env.TOAST_API_BASE_URL,
    TOAST_CLIENT_ID: process.env.TOAST_CLIENT_ID,
    TOAST_CLIENT_SECRET: process.env.TOAST_CLIENT_SECRET,
    TOAST_RESTAURANT_GUID: process.env.TOAST_RESTAURANT_GUID,
    TOAST_WEBHOOK_SECRET: process.env.TOAST_WEBHOOK_SECRET,
    TOAST_RACING_ITEM_GUIDS: process.env.TOAST_RACING_ITEM_GUIDS,
    TOAST_RACING_CATEGORY_GUIDS: process.env.TOAST_RACING_CATEGORY_GUIDS,
    TOAST_DEFAULT_SESSION_MINUTES: process.env.TOAST_DEFAULT_SESSION_MINUTES,
    TOAST_DEFAULT_SESSION_PODS: process.env.TOAST_DEFAULT_SESSION_PODS
  });
}

export const env = new Proxy({} as Env, {
  get(_target, prop: keyof Env) {
    return readEnv()[prop];
  }
});
