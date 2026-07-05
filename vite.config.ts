/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["apple-touch-icon.png"],
      workbox: {
        // Precache the entire build output so the whole game runs offline
        // after the first visit (all audio is synthesized — no media files
        // yet, but the patterns cover them for when they arrive).
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg,woff,woff2,ttf,mp3,wav,ogg}",
        ],
      },
      manifest: {
        name: "Going Gold",
        short_name: "Going Gold",
        description:
          "A game-dev-studio management sim: start in a 1985 garage, ship era-defining games — or chase trends into bankruptcy.",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        background_color: "#09090b",
        theme_color: "#09090b",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
