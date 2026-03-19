import { Outlet } from '@tanstack/react-router';
import { Box, Container, AppBar, Toolbar, Typography, CssBaseline } from '@mui/material';
import { Boxes } from 'lucide-react';

function App() {
  return (
    <>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" elevation={2}>
          <Toolbar>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Boxes size={28} />
              <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                {{PROJECT_NAME}}
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
          <Container maxWidth="xl">
            <Outlet />
          </Container>
        </Box>

        <Box
          component="footer"
          sx={{
            py: 3,
            px: 2,
            mt: 'auto',
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Container maxWidth="xl">
            <Typography variant="body2" color="text.secondary" align="center">
              Built with React, Material UI, and TypeScript
            </Typography>
          </Container>
        </Box>
      </Box>
    </>
  );
}

export default App;
