import { BLOCKS, INLINES, type Document } from '@contentful/rich-text-types';
import { documentToHtmlString, type Options } from '@contentful/rich-text-html-renderer';
import { createClient, type Asset, type Entry, type EntrySkeletonType } from 'contentful';

import { env } from '@/lib/supabase/env';
import { type RaceRadarPost } from '@/lib/race-radar/types';

type RaceRadarSkeleton = EntrySkeletonType<Record<string, unknown>, string>;

const defaults = {
  environment: 'master',
  contentType: ['nightlyEvent', 'blogPost', 'blog', 'post', 'article'],
  title: ['title', 'postTitle', 'headline', 'name'],
  slug: ['slug', 'urlSlug', 'path'],
  excerpt: ['excerpt', 'summary', 'subtitle', 'subheading'],
  coverImage: ['coverImage', 'featuredImage', 'heroImage', 'mainImage', 'image', 'thumbnail'],
  body: ['description', 'body', 'content', 'postBody', 'articleBody', 'copy', 'text'],
  tags: ['tags', 'categories', 'category'],
  date: ['date', 'publishedAt', 'publishDate', 'eventDate']
};

type ContentfulField = {
  id: string;
  name: string;
  type: string;
  linkType?: string;
};

type ContentfulContentType = {
  sys: { id: string };
  name: string;
  fields: ContentfulField[];
};

type ResolvedModel = {
  contentType: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  coverImage: string | null;
  body: string | null;
  tags: string | null;
  date: string | null;
};

function deliveryToken() {
  return env.CONTENTFUL_DELIVERY_TOKEN ?? env.CONTENTFUL_ACCESS_TOKEN;
}

function contentfulConfigured() {
  return Boolean(env.CONTENTFUL_SPACE_ID && deliveryToken());
}

function client() {
  const accessToken = deliveryToken();
  if (!env.CONTENTFUL_SPACE_ID || !accessToken) {
    throw new Error('Contentful is not configured.');
  }

  return createClient({
    space: env.CONTENTFUL_SPACE_ID,
    accessToken,
    environment: env.CONTENTFUL_ENVIRONMENT ?? defaults.environment
  });
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findField(fields: ContentfulField[], configured: string | undefined, aliases: string[]) {
  if (configured) return fields.find((field) => field.id === configured)?.id ?? configured;
  const candidates = aliases.map(normalized);
  return fields.find((field) => candidates.includes(normalized(field.id)) || candidates.includes(normalized(field.name)))?.id ?? null;
}

function scoreContentType(contentType: ContentfulContentType) {
  const preferredIndex = defaults.contentType.findIndex((candidate) => normalized(candidate) === normalized(contentType.sys.id));
  const title = findField(contentType.fields, undefined, defaults.title);
  const body = findField(contentType.fields, undefined, defaults.body);
  const slug = findField(contentType.fields, undefined, defaults.slug);
  const coverImage = findField(contentType.fields, undefined, defaults.coverImage);
  return (preferredIndex >= 0 ? 100 - preferredIndex : 0) + (title ? 30 : 0) + (body ? 30 : 0) + (slug ? 15 : 0) + (coverImage ? 10 : 0);
}

let resolvedModelPromise: Promise<ResolvedModel> | null = null;

async function resolveModel(): Promise<ResolvedModel> {
  if (resolvedModelPromise) return resolvedModelPromise;

  resolvedModelPromise = (async () => {
    const response = await client().getContentTypes();
    const contentTypes = response.items as unknown as ContentfulContentType[];
    const configuredType = env.CONTENTFUL_CONTENT_TYPE;
    const contentType = configuredType
      ? contentTypes.find((candidate) => candidate.sys.id === configuredType)
      : [...contentTypes].sort((a, b) => scoreContentType(b) - scoreContentType(a))[0];

    if (!contentType) {
      throw new Error(
        configuredType
          ? `Contentful content type "${configuredType}" was not found.`
          : 'No Contentful content type was found for Race Radar.'
      );
    }

    const title = findField(contentType.fields, env.CONTENTFUL_FIELD_TITLE, defaults.title);
    if (!title) {
      throw new Error(
        `Contentful content type "${contentType.sys.id}" has no recognizable title field. Set CONTENTFUL_FIELD_TITLE in Vercel.`
      );
    }

    return {
      contentType: contentType.sys.id,
      title,
      slug: findField(contentType.fields, env.CONTENTFUL_FIELD_SLUG, defaults.slug),
      excerpt: findField(contentType.fields, env.CONTENTFUL_FIELD_EXCERPT, defaults.excerpt),
      coverImage: findField(contentType.fields, env.CONTENTFUL_FIELD_COVER_IMAGE, defaults.coverImage),
      body: findField(contentType.fields, env.CONTENTFUL_FIELD_BODY, defaults.body),
      tags: findField(contentType.fields, env.CONTENTFUL_FIELD_TAGS, defaults.tags),
      date: findField(contentType.fields, env.CONTENTFUL_FIELD_DATE, defaults.date)
    };
  })();

  return resolvedModelPromise;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'race-radar'
  );
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function tags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(text).map((tag) => tag.trim()).filter(Boolean);
  const raw = text(value);
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function assetUrl(value: unknown): string | null {
  const asset = value as Asset | undefined;
  const url = asset?.fields?.file?.url;
  if (typeof url !== 'string' || url.length === 0) return null;
  return url.startsWith('//') ? `https:${url}` : url;
}

function plainTextFromRichText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { value?: unknown; content?: unknown };
  const ownValue = typeof node.value === 'string' ? node.value : '';
  const children = Array.isArray(node.content) ? node.content.map(plainTextFromRichText).join(' ') : '';
  return `${ownValue} ${children}`.replace(/\s+/g, ' ').trim();
}

function richTextOptions(): Options {
  return {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const url = assetUrl(node.data.target);
        const title = text((node.data.target as Asset | undefined)?.fields?.title);
        return url ? `<img src="${url}" alt="${title.replace(/"/g, '&quot;')}" />` : '';
      },
      [INLINES.HYPERLINK]: (node, next) => {
        const uri = text(node.data.uri);
        return `<a href="${uri}" rel="noopener noreferrer" target="_blank">${next(node.content)}</a>`;
      }
    }
  };
}

function bodyHtml(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const maybeDoc = value as Partial<Document>;
  if (maybeDoc.nodeType === 'document') return documentToHtmlString(maybeDoc as Document, richTextOptions());
  return '';
}

function excerpt(value: unknown, bodyValue: unknown, body: string) {
  const supplied = text(value).trim();
  if (supplied) return supplied;
  const plainBody = plainTextFromRichText(bodyValue) || body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plainBody.length > 220 ? `${plainBody.slice(0, 217).trimEnd()}...` : plainBody;
}

function normalizeEntry(entry: Entry<RaceRadarSkeleton>, ids: ResolvedModel): RaceRadarPost {
  const fields = entry.fields as Record<string, unknown>;
  const title = text(fields[ids.title]) || 'Race Radar';
  const slug = (ids.slug ? text(fields[ids.slug]) : '') || slugify(title);
  const bodyValue = ids.body ? fields[ids.body] : null;
  const body = bodyHtml(bodyValue);

  return {
    id: entry.sys.id,
    slug,
    title,
    excerpt: excerpt(ids.excerpt ? fields[ids.excerpt] : null, bodyValue, body),
    cover_image_url: assetUrl(ids.coverImage ? fields[ids.coverImage] : null),
    body,
    body_json: bodyValue ?? null,
    tags: tags(ids.tags ? fields[ids.tags] : null),
    published: true,
    published_at: (ids.date ? text(fields[ids.date]) : '') || entry.sys.updatedAt || entry.sys.createdAt || null,
    created_by: null,
    created_at: entry.sys.createdAt ?? entry.sys.updatedAt ?? new Date(0).toISOString(),
    updated_at: entry.sys.updatedAt ?? entry.sys.createdAt ?? new Date(0).toISOString()
  };
}

export async function listContentfulRaceRadarPosts(): Promise<RaceRadarPost[] | null> {
  if (!contentfulConfigured()) return null;
  const ids = await resolveModel();
  const response = await client().getEntries<RaceRadarSkeleton>({
    content_type: ids.contentType,
    order: ['-sys.updatedAt'],
    include: 2,
    limit: 100
  });
  return response.items.map((entry) => normalizeEntry(entry, ids));
}

export async function getContentfulRaceRadarPost(slug: string): Promise<RaceRadarPost | null | undefined> {
  if (!contentfulConfigured()) return undefined;
  const ids = await resolveModel();
  if (!ids.slug) {
    const posts = await listContentfulRaceRadarPosts();
    return posts?.find((post) => post.slug === slug) ?? null;
  }
  const response = await client().getEntries<RaceRadarSkeleton>({
    content_type: ids.contentType,
    [`fields.${ids.slug}`]: slug,
    include: 2,
    limit: 1
  });
  return response.items[0] ? normalizeEntry(response.items[0], ids) : null;
}
