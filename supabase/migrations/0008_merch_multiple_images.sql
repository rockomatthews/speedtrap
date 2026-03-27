alter table public.merch_items
  add column if not exists image_urls text[] not null default '{}';

update public.merch_items
set image_urls = case
  when image_url is not null and image_url <> '' then array[image_url]
  else '{}'
end
where coalesce(array_length(image_urls, 1), 0) = 0;

