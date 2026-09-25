import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        primary: {
            main: "#1976d2",
            light: "#42a5f5",
            dark: "#1565c0",
            contrastText: "#fff",
        },
        secondary: {
            main: "#dc004e",
            light: "#e33371",
            dark: "#9a0036",
            contrastText: "#fff",
        },
        background: {
            default: "#f5f5f5",
            paper: "#ffffff",
        },
        text: {
            primary: "#212121",
            secondary: "#757575",
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.2 },
        h2: { fontSize: "2.5rem", fontWeight: 600, lineHeight: 1.3 },
        h3: { fontSize: "2rem", fontWeight: 600, lineHeight: 1.4 },
        h4: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4 },
        h5: { fontSize: "1.25rem", fontWeight: 500, lineHeight: 1.5 },
        h6: { fontSize: "1rem", fontWeight: 500, lineHeight: 1.6 },
        body1: { fontSize: "1rem", lineHeight: 1.6 },
        body2: { fontSize: "0.875rem", lineHeight: 1.6 },
    },
    shape: { borderRadius: 8 },
    shadows: [
        "none",
        "0px 2px 4px rgba(0,0,0,0.05)",
        "0px 4px 8px rgba(0,0,0,0.08)",
        "0px 8px 16px rgba(0,0,0,0.1)",
        "0px 12px 24px rgba(0,0,0,0.12)",
        "0px 16px 32px rgba(0,0,0,0.14)",
        "0px 20px 40px rgba(0,0,0,0.16)",
        "0px 24px 48px rgba(0,0,0,0.18)",
        "0px 28px 56px rgba(0,0,0,0.20)",
        "0px 32px 64px rgba(0,0,0,0.22)",
        "0px 2px 4px rgba(0,0,0,0.05)",
        "0px 4px 8px rgba(0,0,0,0.08)",
        "0px 8px 16px rgba(0,0,0,0.1)",
        "0px 12px 24px rgba(0,0,0,0.12)",
        "0px 16px 32px rgba(0,0,0,0.14)",
        "0px 20px 40px rgba(0,0,0,0.16)",
        "0px 24px 48px rgba(0,0,0,0.18)",
        "0px 28px 56px rgba(0,0,0,0.20)",
        "0px 32px 64px rgba(0,0,0,0.22)",
        "0px 36px 72px rgba(0,0,0,0.24)",
        "0px 40px 80px rgba(0,0,0,0.26)",
        "0px 44px 88px rgba(0,0,0,0.28)",
        "0px 48px 96px rgba(0,0,0,0.30)",
        "0px 52px 104px rgba(0,0,0,0.32)",
        "0px 56px 112px rgba(0,0,0,0.34)",
    ],
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 500,
                    borderRadius: 8,
                    padding: "10px 24px",
                },
                contained: {
                    boxShadow: "0px 2px 8px rgba(0,0,0,0.1)",
                    "&:hover": {
                        boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: { borderRadius: 12, boxShadow: "0px 4px 20px rgba(0,0,0,0.08)" },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: { "& .MuiOutlinedInput-root": { borderRadius: 8 } },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: { borderRadius: 12 },
                elevation1: { boxShadow: "0px 2px 4px rgba(0,0,0,0.05)" },
                elevation2: { boxShadow: "0px 4px 8px rgba(0,0,0,0.08)" },
                elevation3: { boxShadow: "0px 8px 16px rgba(0,0,0,0.1)" },
            },
        },
    },
});
