import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig ({
    main: {
        build: {
            rollupOptions: {
                output: { format: 'es', entryFileNames: 'index.js'}
            }
        }
    },
    preload: {
        build: {
            externalizeDeps: false,
            rollupOptions: {
                output: {
                    format: 'cjs',
                    entryFileNames: 'index.cjs',
                    inlineDynamicImports: true
                }
            }
        }
    },
    renderer: {
        plugins: [react(), tailwindcss()],
        build: {
            rollupOptions: {
                input: {
                    dashboard: resolve('src/renderer/index.html'),
                    overlay: resolve('src/renderer/overlay/index.html')
                }
            }
        }
    }
})