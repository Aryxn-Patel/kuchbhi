import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      // SSR error wrapper lives in src/server.ts — point Nitro at it.
      server: { entry: "server" },
    }),
    // Without this, Vercel has no Nitro build to turn into a serverless
    // Function — it deploys static assets only and every route 404s.
    nitro(),
    viteReact(),
  ],
});