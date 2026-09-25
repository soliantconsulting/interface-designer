import { AppBar, Box, Container, Toolbar, Typography } from "@mui/material";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { Boxes } from "lucide-react";
import type { ReactNode } from "react";

export type RootRouterContext = {
    queryClient: QueryClient;
};

const Root = (): ReactNode => (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AppBar position="static" elevation={2}>
            <Toolbar>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Boxes size={28} />
                    <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                        {{PROJECT_NAME}}
                    </Typography>
                </Box>
            </Toolbar>
        </AppBar>

        <Box component="main" sx={{ flexGrow: 1, bgcolor: "background.default" }}>
            <Container maxWidth="xl">
                <Outlet />
            </Container>
        </Box>

        <Box
            component="footer"
            sx={{
                py: 3,
                px: 2,
                mt: "auto",
                bgcolor: "background.paper",
                borderTop: "1px solid",
                borderColor: "divider",
            }}
        >
            <Container maxWidth="xl">
                <Typography variant="body2" color="text.secondary" align="center">
                    Built with React, Material UI, and TypeScript
                </Typography>
            </Container>
        </Box>
    </Box>
);

export const Route = createRootRouteWithContext<RootRouterContext>()({
    component: Root,
});
