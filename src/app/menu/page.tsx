import Link from 'next/link';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { NavBar } from '@/components/NavBar';
import { BUSINESS_HOURS, SITE_CONTACT } from '@/lib/site-info';

type MenuItem = {
  name?: string;
  description: string;
  price?: string;
};

type MenuSection = {
  title: string;
  note?: string;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    title: 'Shareables',
    items: [
      { name: 'Pretzel Gear Sticks', description: 'Fried stick shirts, beer cheese, mustard', price: '12' },
      { name: 'Potato Skin Pit Stops', description: '', price: '13.50' },
      { name: 'Crazy Tater Tots', description: 'Cajun tots, beer cheese, bacon, jalapenos', price: '14' },
      { name: 'Dirty Track Rings', description: 'Onion rings, bleu cheese dressing', price: '14' },
      { name: 'Mozzarella Sticks', description: '', price: '12' },
      { name: 'Fresh Fried Artichoke Potatoes, Or Tater Tots', description: '', price: '8' },
      { name: 'Mushroom Motocross Potstickers (V)', description: '', price: '10' },
      {
        name: 'Loaded Nachos',
        description: 'Spicy ground beef, beer cheese, peppers, onions, jalapenos, and tomatoes. Served with salsa',
        price: '14'
      },
      { name: 'Crispy Fried Sprouts', description: 'Topped with goat cheese, bacon, and hot honey drizzle', price: '12' },
      { name: 'The Pace Car Platter', description: 'Hummus dip, cucumber, celery, chips', price: '14' }
    ]
  },
  {
    title: "Wingman's Delight",
    note: 'Available in traditional or boneless. Add celery and ranch or bleu cheese.',
    items: [
      { name: '12 Boneless Wings', description: '', price: '12' },
      {
        name: '10 Traditional Wings',
        description:
          'Sauces: Garlic Parmesan | BBQ | Teriyaki | Mild | Medium | Hot | Dry Sriracha | Ranch | Wet Cajun | Hot Honey | Hot Garlic | Gold Finger | Extreme Heat | Sweet & Sour Asian Zing',
        price: '15'
      }
    ]
  },
  {
    title: 'Lighter Fare',
    items: [
      { name: 'Cobb', description: 'Spring mix, grilled chicken, bacon, avocado, egg, tomato, onion, and bleu cheese crumbles', price: '16.00' },
      { name: 'Caesar', description: 'Romaine, garlic croutons, and shaved parmesan cheese', price: '9.00' },
      { name: 'The Homestead', description: 'Spring mix, mixed cheese, tomato, onion, cucumber', price: '9.00' },
      {
        name: 'Bourbon Glazed Salmon',
        description: 'Spring mix, walnuts, red onion, dried cranberries, goat cheese with raspberry vinaigrette dressing',
        price: '18.00'
      },
      {
        name: 'The Blackened Chicane',
        description: 'Spring mix, fire roasted corn salsa, tortilla strips, tomato, and cheddar cheese',
        price: '15.00'
      }
    ]
  },
  {
    title: 'Entrees',
    note: 'All entrees are served with a small salad and garlic bread.',
    items: [
      { name: 'Blackened Chicken Alfredo', description: 'Blackened chicken, pasta, and alfredo sauce', price: '20' },
      { name: 'Spaghetti And Meatballs', description: 'Meatballs, spaghetti, and marinara sauce', price: '17' },
      { name: 'Chicken Parmesan Dinner', description: 'Breaded chicken breast, marinara sauce, pasta topped with parmesan cheese', price: '20' }
    ]
  },
  {
    title: 'Smash Burgers',
    note:
      'Our all-beef burgers are a premium blend of ground chuck, short rib, and brisket. These double deckers are served on a brioche bun. Substitute any burger with a juicy chicken breast or black bean burger.',
    items: [
      { name: 'Pit Stop Smash', description: 'Double decker, American cheese, lettuce, tomato, onion, pickle', price: '15.50' },
      { name: 'Bacon Burnout', description: 'Bacon, cheddar, onion ring, BBQ', price: '16.50' },
      { name: 'Mushroom Slick', description: 'Sauteed mushrooms and onions, baby Swiss, lettuce, tomato, pickles', price: '16.50' },
      { name: 'Pole Position', description: 'Fried egg, bacon, lettuce, tomato, smoked cheddar, aioli', price: '16.50' },
      {
        name: 'The Daytona 500',
        description: 'Old sub style burger - two 1/4 lb patties with salami, provolone cheese, lettuce, onion, and secret sauce on a fresh hoagie',
        price: '16.50'
      },
      { name: 'Green Flag Special', description: 'Any option black bean burger or grilled chicken', price: '16.50' },
      { name: 'Silverado', description: '1000 Island, diced onion, shredded lettuce, pickles, and American cheese', price: '16.50' }
    ]
  },
  {
    title: 'Sandwiches',
    items: [
      { name: 'Maranello', description: 'Ham, pepperoni, salami, provolone cheese, banana peppers, red onion, tomato, lettuce, Italian dressing', price: '15' },
      { name: 'The BLTA Drag Racer', description: 'Bacon, lettuce, tomato, mayo, and avocado on white bread', price: '14.50' },
      { name: 'The Philly Special', description: 'Shaved ribeye, sauteed bell peppers, onions, and cheese sauce', price: '16' },
      { name: 'The Melt', description: 'Swiss, provolone, pepperjack, onion jam on white bread', price: '14.50' },
      { name: 'Meatball Sub', description: '4 large meatballs smothered in sauce and melted provolone cheese', price: '15.50' },
      {
        name: 'Nashville Hot Chicken Sandwich',
        description: "Breaded chicken spiced Nashville style topped with Tony Packo's pickles and mayo on a toasted brioche bun",
        price: '15.50'
      },
      { name: 'The White Door Fried Chicken Sandwich', description: 'Fried chicken, paprikash, pickle', price: '15.50' },
      { name: 'California Chicken', description: 'Grilled chicken, provolone, lettuce, tomato, ranch dressing', price: '15' }
    ]
  },
  {
    title: 'Wraps',
    items: [
      {
        name: 'The Blackened Burnout Wrap',
        description: 'Blackened chicken, lettuce, tortilla strips, cheddar jack cheese, and fire roasted corn salsa served with spicy ranch',
        price: '14'
      },
      { name: "The Caesar's Circuit Wrap", description: 'Chopped Caesar wrap with garlic croutons and shaved parmesan', price: '14.00' },
      {
        name: 'The Buffalo Speedway Wrap',
        description: 'Fried or grilled chicken tossed in medium sauce, cheddar jack cheese, lettuce, tomato, red onion, and choice of ranch or bleu cheese',
        price: '14'
      }
    ]
  },
  {
    title: 'Checkered Flag Churros',
    items: [{ description: 'Churros topped with chocolate sauce and vanilla bean ice cream', price: '8' }]
  },
  {
    title: 'Kids Kart',
    note: 'All kids meals are served with fresh cut fries. For children 12 years and younger please.',
    items: [{ description: 'Chicken Strip Speedsters | Corn Dog Derby | Jr. Pit Smash Burger | Mac N Cheese | Grilled Cheese', price: '8' }]
  }
];

const menuHighlights = [
  { label: 'Race fuel', value: 'Fresh cut fries included' },
  { label: 'Groups', value: 'Built for tables and heats' },
  { label: 'Kitchen', value: 'Bar food with a grid-start edge' }
];

function MenuCard({ section, index }: { section: MenuSection; index: number }) {
  return (
    <Box key={section.title} sx={{ breakInside: 'avoid', mb: 3 }}>
      <Card
        variant="outlined"
        sx={{
          bgcolor: '#FFD200',
          color: '#050505',
          borderColor: 'rgba(255,210,0,0.72)',
          borderRadius: 0,
          transform: { md: index % 3 === 1 ? 'perspective(1200px) rotateY(-1.4deg)' : 'perspective(1200px) rotateY(1deg)' },
          transformOrigin: index % 3 === 1 ? 'left center' : 'right center',
          boxShadow: '0 22px 54px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(5,5,5,0.10)',
          overflow: 'hidden',
          position: 'relative',
          transition: 'transform 180ms ease, box-shadow 180ms ease',
          '&:hover': {
            transform: { md: 'perspective(1200px) rotateY(0deg) translateY(-5px)' },
            boxShadow: '0 30px 72px rgba(0,0,0,0.55), 0 0 24px rgba(255,210,0,0.20)'
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.12,
            backgroundImage:
              'linear-gradient(135deg, transparent 0 68%, rgba(255,22,31,0.92) 68% 72%, transparent 72%), repeating-linear-gradient(180deg, rgba(5,5,5,0.20) 0 1px, transparent 1px 8px)'
          }
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3 }, position: 'relative', zIndex: 1 }}>
          <Typography
            variant="h4"
            sx={{
              color: '#FF161F',
              fontWeight: 950,
              textTransform: 'uppercase',
              fontStyle: 'italic',
              borderBottom: '4px solid #FF161F',
              pb: 1,
              mb: 2,
              fontSize: { xs: 31, md: 42 },
              lineHeight: 0.98,
              overflowWrap: 'anywhere'
            }}
          >
            {section.title}
          </Typography>
          {section.note ? (
            <Typography sx={{ mb: 2, color: 'rgba(5,5,5,0.78)', fontWeight: 850, lineHeight: 1.45 }}>{section.note}</Typography>
          ) : null}
          <Stack spacing={1.75}>
            {section.items.map((item, itemIndex) => (
              <Box
                key={`${section.title}-${item.name ?? itemIndex}`}
                sx={{
                  py: itemIndex === 0 ? 0 : 0.25,
                  borderTop: itemIndex === 0 ? 'none' : '1px solid rgba(5,5,5,0.12)'
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="baseline">
                  {item.name ? (
                    <Typography sx={{ flex: 1, fontWeight: 950, fontSize: { xs: 18, md: 19 }, lineHeight: 1.2 }}>{item.name}</Typography>
                  ) : (
                    <Box sx={{ flex: 1 }} />
                  )}
                  {item.price ? (
                    <Typography sx={{ color: '#FF161F', fontWeight: 950, fontSize: { xs: 18, md: 22 } }}>{item.price}</Typography>
                  ) : null}
                </Stack>
                {item.description ? (
                  <Typography sx={{ mt: 0.45, color: 'rgba(5,5,5,0.74)', lineHeight: 1.45 }}>{item.description}</Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function MenuPage() {
  return (
    <Box
      sx={{
        bgcolor: '#050505',
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, #050505 0%, #0A0A0A 44%, #050505 100%), radial-gradient(900px 520px at 84% 8%, rgba(255,22,31,0.24), transparent 64%)'
      }}
    >
      <NavBar />
      <Box
        component="section"
        sx={{
          position: 'relative',
          minHeight: { xs: 520, md: 620 },
          display: 'grid',
          alignItems: 'end',
          pt: { xs: 10, md: 14 },
          pb: { xs: 5, md: 7 },
          overflow: 'hidden',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          backgroundImage:
            'linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.72) 42%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.90) 100%), url(/home/speedtrap-restaurant-bar.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center 48%',
          isolation: 'isolate',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            opacity: 0.2,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '46px 46px'
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 1,
            background:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 2px, transparent 7px)'
          }
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            right: { xs: -145, md: -55 },
            bottom: { xs: 32, md: -4 },
            width: { xs: 360, md: 620 },
            height: { xs: 150, md: 250 },
            zIndex: 2,
            transform: 'skewX(-24deg) rotate(-10deg)',
            background:
              'linear-gradient(90deg, transparent 0 18%, #FFD200 18% 34%, transparent 34% 42%, #FF161F 42% 58%, transparent 58% 100%)',
            opacity: 0.92,
            filter: 'drop-shadow(0 0 24px rgba(255,22,31,0.36))'
          }}
        />
        <Container sx={{ position: 'relative', zIndex: 3 }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="end">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip label="Eat. Drink. Race." color="primary" />
                  <Chip label="Full kitchen" color="primary" />
                  <Chip label="Race-night tables" color="primary" />
                </Stack>
                <Typography
                  component="h1"
                  sx={{
                    maxWidth: 900,
                    fontSize: { xs: 56, sm: 82, md: 118 },
                    lineHeight: 0.86,
                    fontWeight: 950,
                    letterSpacing: 0,
                    textTransform: 'uppercase',
                    fontStyle: 'italic',
                    textWrap: 'balance'
                  }}
                >
                  <Box component="span" sx={{ display: 'block', color: '#FFD200' }}>
                    Speed Trap
                  </Box>
                  <Box component="span" sx={{ display: 'block', color: '#fff' }}>
                    Menu.
                  </Box>
                </Typography>
                <Typography color="text.secondary" sx={{ maxWidth: 650, lineHeight: 1.45, fontSize: { xs: 19, md: 24 } }}>
                  Food built for race nights, group tables, and leaderboard runs.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ maxWidth: { xs: 360, sm: 'none' } }}>
                  <Button component={Link} href="/pricing#private-events" variant="contained" size="large">
                    Plan a Party
                  </Button>
                  <Button component={Link} href="/leaderboards" variant="outlined" size="large">
                    View Leaderboards
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  border: '1px solid rgba(255,210,0,0.52)',
                  bgcolor: 'rgba(0,0,0,0.58)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 0 42px rgba(255,22,31,0.18)',
                  p: { xs: 2, md: 2.5 },
                  transform: { md: 'skew(-4deg)' }
                }}
              >
                <Stack spacing={1.5} sx={{ transform: { md: 'skew(4deg)' } }}>
                  <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                    Today tastes faster
                  </Typography>
                  {menuHighlights.map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        bgcolor: 'rgba(255,255,255,0.08)',
                        borderLeft: '5px solid rgba(255,210,0,0.72)'
                      }}
                    >
                      <Typography sx={{ fontWeight: 950 }}>{item.label}</Typography>
                      <Typography color="text.secondary">{item.value}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={{ xs: 4, md: 5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Box
                sx={{
                  border: '1px solid rgba(255,210,0,0.55)',
                  bgcolor: '#FFD200',
                  color: '#050505',
                  p: { xs: 2.5, md: 3 },
                  minHeight: '100%',
                  boxShadow: '0 0 32px rgba(255,210,0,0.16)'
                }}
              >
                <Typography sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                  All burgers, sandwiches, and wraps are served with fresh cut fries.
                </Typography>
                <Typography sx={{ mt: 0.75, fontWeight: 800 }}>
                  Upgrade to tater tots or sweet potato fries +2.50
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 2.5, md: 3 },
                  border: '1px solid rgba(255,255,255,0.12)',
                  bgcolor: 'rgba(255,255,255,0.045)'
                }}
              >
                <Typography color="primary" sx={{ fontWeight: 950, textTransform: 'uppercase' }}>
                  Visit
                </Typography>
                <Typography sx={{ mt: 1, fontWeight: 900 }}>{SITE_CONTACT.address}</Typography>
                <Typography color="text.secondary">{SITE_CONTACT.phone}</Typography>
                <Stack spacing={0.25} sx={{ mt: 1.25 }}>
                  {BUSINESS_HOURS.map((hours) => (
                    <Stack key={hours.day} direction="row" spacing={1.5} justifyContent="space-between">
                      <Typography sx={{ fontWeight: 900 }}>{hours.shortDay}</Typography>
                      <Typography color="text.secondary" sx={{ textAlign: 'right' }}>
                        {hours.label}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {menuSections.map((section) => (
              <Button
                key={section.title}
                component="a"
                href={`#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                variant="text"
                sx={{ color: '#fff', fontWeight: 900, border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {section.title}
              </Button>
            ))}
          </Stack>

          <Box sx={{ columnCount: { xs: 1, lg: 2 }, columnGap: 3 }}>
            {menuSections.map((section, index) => (
              <Box key={section.title} id={section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')} sx={{ scrollMarginTop: 110 }}>
                <MenuCard section={section} index={index} />
              </Box>
            ))}
          </Box>

          <Box
            sx={{
              border: '1px solid rgba(255,210,0,0.55)',
              p: { xs: 2.5, md: 3 },
              bgcolor: 'rgba(255,255,255,0.045)',
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,22,31,0.05)), radial-gradient(500px 240px at 92% 18%, rgba(255,22,31,0.20), transparent 68%)'
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <Typography variant="h3" sx={{ fontWeight: 950, fontStyle: 'italic', textTransform: 'uppercase' }}>
                  Race first, refuel after.
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
                  Book a sim session, meet your group at the table, and keep the board moving all night.
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent={{ md: 'flex-end' }}>
                  <Button component={Link} href="/book?duration=15" variant="contained" size="large">
                    Book a Race
                  </Button>
                  <Button component={Link} href="/pricing" variant="outlined" size="large">
                    Pricing
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
