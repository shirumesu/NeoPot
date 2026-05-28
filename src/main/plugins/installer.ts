import { app } from 'electron';
import AdmZip from 'adm-zip';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PluginInfo {
    type: string;
    name: string;
}

export interface PluginInstallResult {
    status: 'installed';
    type: string;
    name: string;
}

class PluginInstallError extends Error {
    constructor(readonly code: 'PLUGIN_INVALID_PACKAGE' | 'PLUGIN_ZIP_SLIP', message: string) {
        super(message);
        this.name = 'PluginInstallError';
    }
}

function pluginRoot(): string {
    return path.join(app.getPath('userData'), 'plugins');
}

function assertInside(parent: string, child: string): void {
    const parentPath = path.resolve(parent);
    const childPath = path.resolve(child);
    if (!childPath.startsWith(parentPath + path.sep)) {
        throw new PluginInstallError('PLUGIN_ZIP_SLIP', 'Plugin package contains an unsafe extraction path.');
    }
}

export async function installPlugin(file: string): Promise<PluginInstallResult> {
    const zip = new AdmZip(file);
    const entries = zip.getEntries();
    const manifestEntry = entries.find((entry) => entry.entryName === 'info.json');
    const mainEntry = entries.find((entry) => entry.entryName === 'main.js');

    if (!manifestEntry || !mainEntry) {
        throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin package must contain info.json and main.js.');
    }

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as { plugin_type?: string; name?: string };
    const pluginType = manifest.plugin_type;
    const pluginName = manifest.name;
    if (!pluginType || !pluginName) {
        throw new PluginInstallError('PLUGIN_INVALID_PACKAGE', 'Plugin manifest is missing plugin_type or name.');
    }

    const targetDir = path.join(pluginRoot(), pluginType, pluginName);
    const tempDir = `${targetDir}.tmp`;
    await rm(tempDir, { recursive: true, force: true });
    await mkdir(tempDir, { recursive: true });

    try {
        for (const entry of entries) {
            if (entry.isDirectory) {
                continue;
            }

            const targetPath = path.join(tempDir, entry.entryName);
            assertInside(tempDir, targetPath);
            await mkdir(path.dirname(targetPath), { recursive: true });
            await writeFile(targetPath, entry.getData());
        }

        await rm(targetDir, { recursive: true, force: true });
        await mkdir(path.dirname(targetDir), { recursive: true });
        await rm(targetDir, { recursive: true, force: true });
        await import('node:fs/promises').then(({ rename }) => rename(tempDir, targetDir));

        return {
            status: 'installed',
            type: pluginType,
            name: pluginName,
        };
    } catch (error) {
        await rm(tempDir, { recursive: true, force: true });
        throw error;
    }
}

export async function uninstallPlugin(type: string, name: string): Promise<void> {
    await rm(path.join(pluginRoot(), type, name), {
        recursive: true,
        force: true,
    });
}

export async function listPlugins(type: string): Promise<PluginInfo[]> {
    const dir = path.join(pluginRoot(), type);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => ({
            type,
            name: entry.name,
        }));
}
