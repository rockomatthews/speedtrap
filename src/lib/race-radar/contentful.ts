import { BLOCKS, INLINES, type Document } from '@contentful/rich-text-types';
import { documentToHtmlString, type Options } from '@contentful/rich-text-html-renderer';
import { createClient, type Asset, type Entry, type EntrySkeletonType } from 'contentful';

import { env } from '@/lib/supabase/env';
import { type RaceRadarPost } from '@/lib/race-radar/types';

type RaceRadarSkeleton = EntrySkeletonType<Record<string, unknown>, string>;

const defaults = {
  environment: 'master',
  contentType: 'blogPost',
  title: 'title',
  slug: 'slug',
  excerpt: 'excerpt',
  coverImage: 'coverImage',
  body: 'body',
  tags: 'tags'
};

function contentfulConfigured() {
  return Boolean(env.CONTENTFUL_SPACE_ID && env.CONTENTFUL_DELIVERY_TOKEN);
}

function fieldIds() {
  return {
    contentType: env.CONTENTFUL_CONTENT_TYPE ?? defaults.contentType,
    title: env.CONTENTFUL_FIELD_TITLE ?? defaults.title,
    slug: env.CONTENTFUL_FIELD_SLUG ?? defaults.slug,
    excerpt: env.CONTENTFUL_FIELD_EXCERPT ?? defaults.excerpt,
    coverImage: env.CONTENTFUL_FIELD_COVER_IMAGE ?? defaults.coverImage,
    body: env.CONTENTFUL_FIELD_BODY ?? defaults.body,
    tags: env.CONTENTFUL_FIELD_TAGS ?? defaults.tags
  };
}

function client() {
  if (!env.CONTENTFUL_SPACE_ID || !env.CONTENTFUL_DELIVERY_TOKEN) {
    throw new Error('Contentful is not configured.');
  }

  return createClient({
    space: env.CONTENTFUL_SPACE_ID,
    accessToken: env.CONTENTFUL_DELIVERY_TOKEN,
    environment: env.CONTENTFUL_ENVIRONMENT ?? defaults.environment
  });
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

function normalizeEntry(entry: Entry<RaceRadarSkeleton>): RaceRadarPost {
  const ids = fieldIds();
  const fields = entry.fields as Record<string, unknown>;
  const title = text(fields[ids.title]) || 'Race Radar';
  const slug = text(fields[ids.slug]) || slugify(title);
  const body = bodyHtml(fields[ids.body]);

  return {
    id: entry.sys.id,
    slug,
    title,
    excerpt: text(fields[ids.excerpt]),
    cover_image_url: assetUrl(fields[ids.coverImage]),
    body,
    body_json: fields[ids.body] ?? null,
    tags: tags(fields[ids.tags]),
    published: true,
    published_at: entry.sys.updatedAt ?? entry.sys.createdAt ?? null,
    created_by: null,
    created_at: entry.sys.createdAt ?? entry.sys.updatedAt ?? new Date(0).toISOString(),
    updated_at: entry.sys.updatedAt ?? entry.sys.createdAt ?? new Date(0).toISOString()
  };
}

export async function listContentfulRaceRadarPosts(): Promise<RaceRadarPost[] | null> {
  if (!contentfulConfigured()) return null;
  const ids = fieldIds();
  const response = await client().getEntries<RaceRadarSkeleton>({
    content_type: ids.contentType,
    order: ['-sys.updatedAt'],
    include: 2,
    limit: 100
  });
  return response.items.map(normalizeEntry);
}

export async function getContentfulRaceRadarPost(slug: string): Promise<RaceRadarPost | null | undefined> {
  if (!contentfulConfigured()) return undefined;
  const ids = fieldIds();
  const response = await client().getEntries<RaceRadarSkeleton>({
    content_type: ids.contentType,
    [`fields.${ids.slug}`]: slug,
    include: 2,
    limit: 1
  });
  return response.items[0] ? normalizeEntry(response.items[0]) : null;
}
