## Contentful Race Radar setup

Race Radar reads from Contentful when these Vercel environment variables are present:

```text
CONTENTFUL_SPACE_ID=
CONTENTFUL_DELIVERY_TOKEN=
CONTENTFUL_CONTENT_TYPE=blogPost
CONTENTFUL_ENVIRONMENT=master
```

Default field IDs:

```text
CONTENTFUL_FIELD_TITLE=title
CONTENTFUL_FIELD_SLUG=slug
CONTENTFUL_FIELD_EXCERPT=excerpt
CONTENTFUL_FIELD_COVER_IMAGE=coverImage
CONTENTFUL_FIELD_BODY=body
CONTENTFUL_FIELD_TAGS=tags
```

Only `CONTENTFUL_SPACE_ID` and `CONTENTFUL_DELIVERY_TOKEN` are always required. Set the other values only if the recovered Contentful content model uses different IDs.

Use a Content Delivery API token, not a Management API token. The public blog routes only read published Contentful entries.
