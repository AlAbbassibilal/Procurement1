import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

/** Inlines the pdf.js worker gzipped + base64 (≈ 1/3 of the raw size) — inflated in the browser when the e-signature viewer needs it. */
function pdfWorkerGz(): Plugin {
  const id = 'virtual:pdf-worker-gz'
  return {
    name: 'pdf-worker-gz',
    resolveId(source) { return source === id ? '\0' + id : null },
    load(source) {
      if (source !== '\0' + id) return null
      const src = readFileSync(path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'))
      return `export default ${JSON.stringify(gzipSync(src, { level: 9 }).toString('base64'))}`
    },
  }
}

export default defineConfig({
  plugins: [react(), pdfWorkerGz()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  // Single JS file: the hosted demo is one self-contained HTML page, so dynamic imports are inlined
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { port: 5173, host: true },
})
