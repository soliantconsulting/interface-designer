import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Every package the scaffold installs is pre-bundled at server start. Left to discovery, Vite
 * serves lucide-react as one module per icon (1,500-plus requests on a cold load) and re-optimizes
 * mid-session the first time a package is imported. MUI icons are imported by subpath
 * (`@mui/icons-material/Add`); add each one here as the app starts using it.
 */
export default defineConfig({
    plugins: [
        tanstackRouter({
            target: "react",
            autoCodeSplitting: true,
            routeFileIgnorePrefix: "-",
        }),
        react(),
    ],
    optimizeDeps: {
        include: [
            "react",
            "react-dom",
            "react-dom/client",
            "@emotion/react",
            "@emotion/styled",
            "@mui/material",
            "@mui/material/styles",
            "@mui/x-data-grid",
            "@mui/x-date-pickers",
            "@mui/x-date-pickers/AdapterDayjs",
            "@tanstack/react-router",
            "@tanstack/react-query",
            "react-hook-form",
            "@hookform/resolvers/zod",
            "mui-rhf-integration",
            "material-react-table",
            "lucide-react",
            "temporal-polyfill/global",
            "zod",
            "zod/mini",
            "zod/locales",
            "uuid",
            "dayjs",
        ],
    },
});
