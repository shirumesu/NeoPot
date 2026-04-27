// @ts-nocheck
import { save, open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { reloadStoreFromDisk } from '../../../../../utils/store';

export async function backup() {
    const selected = await save({
        defaultPath: 'NeoPotConfig.zip',
        filters: [
            {
                name: 'Backup',
                extensions: ['zip'],
            },
        ],
    });
    if (selected !== null) {
        return await invoke('local', {
            operate: 'put',
            path: selected,
        });
    } else {
        throw 'Invalid File';
    }
}

export async function get() {
    const selected = await open({
        multiple: false,
        directory: false,
        filters: [
            {
                name: '*.zip',
                extensions: ['zip'],
            },
        ],
    });

    if (selected !== null && selected.endsWith('zip')) {
        const result = await invoke('local', {
            operate: 'get',
            path: selected,
        });
        await reloadStoreFromDisk();
        return result;
    } else {
        throw 'Invalid File';
    }
}

