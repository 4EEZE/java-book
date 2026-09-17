/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { rustEditorVitePlugin } from "@wcrichto/rust-editor/build-utils";
import fs from "fs";
import { resolve } from "path";
import path from "path";
import { PluginOption, defineConfig } from "vite";

let manifest = JSON.parse(fs.readFileSync("package.json", "utf-8"));
// Собираем @wcrichto/quiz из исходников: у пакета нет своей сборки,
// в оригинале её делал depot. Ключ со стилями должен идти первым —
// vite проверяет алиасы по порядку и берёт первое совпадение префикса.
let alias: Record<string, string> = {
  "@wcrichto/quiz/dist/lib.scss": path.resolve(
    __dirname,
    "../quiz/src/lib.scss"
  ),
  "@wcrichto/quiz": path.resolve(__dirname, "../quiz/src/lib.ts")
};
let plugins: PluginOption[] = [react()];

if (process.env.RUST_EDITOR !== undefined) {
  let serverUrl = !process.argv.includes("--watch")
    ? "https://rust-book.cs.brown.edu/quiz"
    : "http://localhost:3000/quiz";

  plugins.push(rustEditorVitePlugin({ serverUrl }));
} else {
  alias["@wcrichto/rust-editor/dist/lib.css"] = path.resolve(
    __dirname,
    "rust-editor-placeholder.css"
  );
  alias["@wcrichto/rust-editor"] = path.resolve(
    __dirname,
    "rust-editor-placeholder.js"
  );
  
}

export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.tsx"),
      name: "Quiz",
      formats: ["iife"],
    },
    rollupOptions: {
      external: Object.keys(manifest.dependencies || {}),
    },
    sourcemap: true
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
  resolve: { alias },
  plugins,
  test: {
    environment: "jsdom",
    setupFiles: "tests/setup.ts",
    deps: {
      inline: [/^(?!.*vitest).*$/],
    },
  },
}));
