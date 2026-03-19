import { Box, Typography, Card, CardContent } from '@mui/material';

export default function Dashboard() {
  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Dashboard
      </Typography>
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Project scaffolded and ready for design prompts.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
