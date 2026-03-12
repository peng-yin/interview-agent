import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: 'node22',
    lib: {
      entry: {
        main: resolve(__dirname, 'src/main.ts'),
        'scripts/index-knowledge': resolve(__dirname, 'src/scripts/index-knowledge.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        /^@livekit\//,
        /^node:/,
        'dotenv',
        'openai',
        'chromadb',
        'chromadb-default-embed',
        'pdf-parse',
        'zod',
        'fs',
        'path',
        'url',
        'crypto',
        'http',
        'https',
        'stream',
        'os',
        'util',
        'events',
        'buffer',
        'net',
        'tls',
      ],
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
