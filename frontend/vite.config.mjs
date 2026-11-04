
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hotReloadDisabled = process.env.DISABLE_HOT_RELOAD === "true";

// Preserve JSX support for existing .js files.
function jsxInJs() {
  return {
    name: "cra-jsx-in-js",
    enforce: "pre",
    transform(code, id) {
      const file = id.split("?")[0].replace(/\\/g, "/");

      if (
        !/\/src\/.*\.js$/.test(file) ||
        file.includes("/node_modules/")
      ) {
        return null;
      }

      return transformWithOxc(
        code,
        file,
        { lang: "jsx", jsx: { runtime: "automatic" } }
      );
    },
  };
}

// Enable polling to avoid filesystem watcher limits.
if (!hotReloadDisabled) {
  process.env.CHOKIDAR_USEPOLLING = "true";
}

export default defineConfig({
  plugins: [
    jsxInJs(),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },

  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: { ".js": "jsx" },
    },
    include: [
      "@hookform/resolvers",
      "@hookform/resolvers/zod",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      "@tanstack/react-query",
      "axios",
      "class-variance-authority",
      "clsx",
      "cmdk",
      "date-fns",
      "date-fns/locale",
      "dayjs",
      "embla-carousel-react",
      "framer-motion",
      "input-otp",
      "lodash",
      "lodash/debounce",
      "lucide-react",
      "next-themes",
      "prop-types",
      "react",
      "react-day-picker",
      "react-dom/client",
      "react-hook-form",
      "react-is",
      "react-resizable-panels",
      "react-router",
      "react-router-dom",
      "recharts",
      "sonner",
      "swr",
      "tailwind-merge",
      "uuid",
      "vaul",
      "zod",
    ],
  },

  build: {
    outDir: "build",
  },

  server: {
    host: true,
    port: 3000,
    allowedHosts: true,
    hmr: hotReloadDisabled ? false : { overlay: true },
    watch: hotReloadDisabled
      ? null
      : { usePolling: true, interval: 300 },
  },
});
