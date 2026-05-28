import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vendorDir = join(dirname(require.resolve('electron-winstaller/package.json')), 'vendor');
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

for (const extension of ['exe', 'dll']) {
    const target = join(vendorDir, `7z.${extension}`);
    if (!existsSync(target)) {
        copyFileSync(join(vendorDir, `7z-${arch}.${extension}`), target);
    }
}
