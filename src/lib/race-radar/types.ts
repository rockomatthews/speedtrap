export type RaceRadarPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover_image_url: string | null;
  body: string;
  body_json: unknown | null;
  tags: string[];
  published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
