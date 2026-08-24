-- Align online booking schedule rows with the current public business hours.

with desired(day_of_week, opens_at, closes_at) as (
  values
    (0, time '08:00', time '20:00'),
    (1, time '16:00', time '23:00'),
    (2, time '16:00', time '23:00'),
    (3, time '11:00', time '23:00'),
    (4, time '11:00', time '23:00'),
    (5, time '11:00', time '01:00'),
    (6, time '11:00', time '01:00')
),
updated as (
  update public.venue_schedule_rules rules
  set
    opens_at = desired.opens_at,
    closes_at = desired.closes_at,
    active = true,
    updated_at = now()
  from desired
  where rules.day_of_week = desired.day_of_week
  returning rules.day_of_week
)
insert into public.venue_schedule_rules (day_of_week, opens_at, closes_at, active)
select desired.day_of_week, desired.opens_at, desired.closes_at, true
from desired
where not exists (
  select 1
  from updated
  where updated.day_of_week = desired.day_of_week
);
