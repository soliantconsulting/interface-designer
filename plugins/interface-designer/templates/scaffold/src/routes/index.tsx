import { Box, Card, CardContent, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";

const Root = (): ReactNode => (
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

export const Route = createFileRoute("/")({
    component: Root,
});
