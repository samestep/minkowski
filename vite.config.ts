import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  base: "/minkowski/",
  plugins: [react(), topLevelAwait()],
});
