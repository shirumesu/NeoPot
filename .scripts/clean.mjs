import { rmSync } from 'node:fs';

const targets = process.argv.slice(2);

for (const target of targets) {
    try {
        rmSync(target, {
            recursive: true,
            force: true,
            maxRetries: 3,
            retryDelay: 100,
        });
    } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : 'UNKNOWN';
        console.warn(`clean: skipped ${target} (${code})`);
    }
}
