import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AppShell } from '@/components/AppShell';

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

export default function MenuPage() {
  return (
    <Box sx={{ bgcolor: '#050505', minHeight: '100vh' }}>
      <AppShell>
        <Stack spacing={4}>
          <Box>
            <Chip label="Eat. Drink. Race." color="primary" />
            <Typography component="h1" variant="h2" sx={{ mt: 2, fontWeight: 950, textTransform: 'uppercase' }}>
              Speed Trap Menu
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760, fontSize: { xs: 18, md: 22 }, lineHeight: 1.45 }}>
              Food built for race nights, group tables, and leaderboard runs.
            </Typography>
          </Box>

          <Box
            sx={{
              border: '1px solid rgba(255,210,0,0.55)',
              bgcolor: '#FFD200',
              color: '#050505',
              p: { xs: 2.5, md: 3 },
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

          <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 3 }}>
            {menuSections.map((section) => (
              <Box key={section.title} sx={{ breakInside: 'avoid', mb: 3 }}>
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: '#FFD200',
                    color: '#050505',
                    borderColor: 'rgba(255,210,0,0.72)',
                    boxShadow: '0 0 28px rgba(0,0,0,0.28)'
                  }}
                >
                  <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
                    <Typography
                      variant="h4"
                      sx={{
                        color: '#FF161F',
                        fontWeight: 950,
                        textTransform: 'uppercase',
                        fontStyle: 'italic',
                        borderBottom: '3px solid #FF161F',
                        pb: 1,
                        mb: 2
                      }}
                    >
                      {section.title}
                    </Typography>
                    {section.note ? (
                      <Typography sx={{ mb: 2, color: 'rgba(5,5,5,0.78)', fontWeight: 800, lineHeight: 1.45 }}>{section.note}</Typography>
                    ) : null}
                    <Stack spacing={1.75}>
                      {section.items.map((item, index) => (
                        <Box key={`${section.title}-${item.name ?? index}`}>
                          <Stack direction="row" spacing={1.5} alignItems="baseline">
                            {item.name ? (
                              <Typography sx={{ flex: 1, fontWeight: 950, fontSize: 18, lineHeight: 1.2 }}>{item.name}</Typography>
                            ) : (
                              <Box sx={{ flex: 1 }} />
                            )}
                            {item.price ? (
                              <Typography sx={{ color: '#FF161F', fontWeight: 950, fontSize: 18 }}>{item.price}</Typography>
                            ) : null}
                          </Stack>
                          {item.description ? (
                            <Typography sx={{ mt: 0.4, color: 'rgba(5,5,5,0.74)', lineHeight: 1.45 }}>{item.description}</Typography>
                          ) : null}
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Stack>
      </AppShell>
    </Box>
  );
}
