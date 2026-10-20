import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const weeks = [
  ['Nov 30 – Dec 3', 'Oulton Park'], ['Dec 7–10', 'Spa-Francorchamps'],
  ['Dec 14–17', 'Monza'], ['Dec 21–24', 'Nordschleife'],
  ['Dec 28–31', 'Fuji Speedway'], ['Jan 4–7', 'Road America'],
  ['Jan 11–14', 'Phillip Island'], ['Jan 18–21', 'Suzuka']
];
export function WinterSeriesOverview() {
  return <Grid container spacing={3}>
    <Grid size={{ xs: 12, md: 5 }}>
      <Box component="img" src="/leagues/winter-series-2026-27.png" alt="Speed Trap Winter Series 2026–27, presented by NEOHIO SCCA and The Lakewood Observer" sx={{ width: '100%', height: 'auto', borderRadius: 2 }} />
    </Grid>
    <Grid size={{ xs: 12, md: 7 }}>
      <Stack spacing={2}>
        <Typography variant="h4" sx={{ fontWeight: 900 }}>Same car. A new track every week.</Typography>
        <Typography>Eight weeks of unlimited laps on that week’s league track, Monday–Thursday during open hours. Come in when it suits you; teammates do not need to attend together. Book ahead to guarantee a rig.</Typography>
        <Typography>Your fastest valid lap of the week scores for your team. Standings post every Monday. The top teams race live on Championship Night in late January; date to be announced.</Typography>
        <Typography sx={{ fontWeight: 800 }}>Signups close Sunday, November 22. Teams announced November 23–25. Racing starts Monday, November 30, 2026.</Typography>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& th, & td': { p: 1, textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,.15)' } }}>
          <thead><tr><th>Week</th><th>Mon–Thu</th><th>Track</th></tr></thead>
          <tbody>{weeks.map(([dates, track], index) => <tr key={track}><td>{index + 1}</td><td>{dates}</td><td>{track}</td></tr>)}</tbody>
        </Box>
        <Typography color="text.secondary">Holiday weeks follow posted holiday hours. Tracks are subject to change. Other cars, tracks, and Friday–Sunday sim time are charged at regular rates.</Typography>
        <Typography>Drivers must be 16 or older. Under 18 requires guardian permission; every driver signs the STR waiver. Laps count only on STR rigs in the league car and weekly track. Invalid track-limit laps do not count. Stewards Zach, Tra and Carolina have the final say.</Typography>
        <Typography>Questions or rig reservations: 216-712-4039 · events@speedtrapracing.com</Typography>
        <Button href="/leagues/winter-series-rundown.pdf" variant="outlined" sx={{ alignSelf: 'flex-start' }}>Download the series rundown</Button>
      </Stack>
    </Grid>
  </Grid>;
}
