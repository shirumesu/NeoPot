import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'node22',
        lib: {
            entry: 'src/main/index.ts',
            formats: ['cjs'],
            fileName: () => 'main.cjs',
        },
        rollupOptions: {
            external: [
                'electron',
                'better-sqlite3',
                ...builtinModules,
                ...builtinModules.map((moduleName) => `node:${moduleName}`),
            ],
        },
    },
});
