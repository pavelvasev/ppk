import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  base: "./",
  // your other configuration...
  /*
  esbuild: {
    minifyIdentifiers: false,
    keepNames: true,
  },
  */
  build: {
    minify: false, // esbuild
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
});
