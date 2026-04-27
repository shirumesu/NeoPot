import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'path';

const tauriBrowserSmokeAliases = {
    '@tauri-apps/api/core': resolve(__dirname, 'src/dev/tauri-mocks/core.ts'),
    '@tauri-apps/api/webviewWindow': resolve(__dirname, 'src/dev/tauri-mocks/webviewWindow.ts'),
    '@tauri-apps/api/event': resolve(__dirname, 'src/dev/tauri-mocks/event.ts'),
    '@tauri-apps/api/path': resolve(__dirname, 'src/dev/tauri-mocks/path.ts'),
    '@tauri-apps/api/window': resolve(__dirname, 'src/dev/tauri-mocks/window.ts'),
    '@tauri-apps/api/app': resolve(__dirname, 'src/dev/tauri-mocks/app.ts'),
    '@tauri-apps/plugin-store': resolve(__dirname, 'src/dev/tauri-mocks/store.ts'),
    '@tauri-apps/plugin-fs': resolve(__dirname, 'src/dev/tauri-mocks/fs.ts'),
    '@tauri-apps/plugin-log': resolve(__dirname, 'src/dev/tauri-mocks/log.ts'),
    '@tauri-apps/plugin-opener': resolve(__dirname, 'src/dev/tauri-mocks/opener.ts'),
    '@tauri-apps/plugin-autostart': resolve(__dirname, 'src/dev/tauri-mocks/autostart.ts'),
    '@tauri-apps/plugin-os': resolve(__dirname, 'src/dev/tauri-mocks/os.ts'),
    '@tauri-apps/plugin-dialog': resolve(__dirname, 'src/dev/tauri-mocks/dialog.ts'),
    '@tauri-apps/plugin-global-shortcut': resolve(__dirname, 'src/dev/tauri-mocks/globalShortcut.ts'),
    '@tauri-apps/plugin-notification': resolve(__dirname, 'src/dev/tauri-mocks/notification.ts'),
    '@tauri-apps/plugin-clipboard-manager': resolve(__dirname, 'src/dev/tauri-mocks/clipboard.ts'),
    '@tauri-apps/plugin-process': resolve(__dirname, 'src/dev/tauri-mocks/process.ts'),
    '@tauri-apps/plugin-updater': resolve(__dirname, 'src/dev/tauri-mocks/updater.ts'),
    '@tauri-apps/plugin-http': resolve(__dirname, 'src/dev/tauri-mocks/http.ts'),
    '@tauri-apps/plugin-sql': resolve(__dirname, 'src/dev/tauri-mocks/sql.ts'),
};

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            ...(mode === 'browser-smoke' ? tauriBrowserSmokeAliases : {}),
        },
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    // prevent vite from obscuring rust errors
    clearScreen: false,
    // tauri expects a fixed port, fail if that port is not available
    server: {
        port: 1420,
        strictPort: true,
    },
    // to make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ['VITE_', 'TAURI_'],
    build: {
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'index.html'),
                daemon: resolve(__dirname, 'daemon.html'),
            },
        },
        // Keep a modern baseline that works with Vite 8 + Tauri v2 webviews.
        target: 'es2020',
        // don't minify for debug builds
        minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
        // produce sourcemaps for debug builds
        sourcemap: !!process.env.TAURI_DEBUG,
    },
}));
