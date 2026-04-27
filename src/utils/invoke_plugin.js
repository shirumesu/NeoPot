import { appCacheDir, appConfigDir, join } from "@tauri-apps/api/path";
import { readFile, readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import CryptoJS from "crypto-js";
import { osType } from "./env";
import * as http from "@/utils/tauri_http";

async function loadPluginEntrypoint(script, pluginType) {
    const moduleSource = `${script}\nexport default typeof ${pluginType} !== 'undefined' ? ${pluginType} : undefined;\n`;
    const moduleUrl = URL.createObjectURL(new Blob([moduleSource], { type: 'text/javascript' }));

    try {
        const pluginModule = await import(/* @vite-ignore */ moduleUrl);
        return pluginModule.default;
    } finally {
        URL.revokeObjectURL(moduleUrl);
    }
}

export async function invoke_plugin(pluginType, pluginName) {
    let configDir = await appConfigDir();
    let cacheDir = await appCacheDir();
    let pluginDir = await join(configDir, "plugins", pluginType, pluginName);
    let entryFile = await join(pluginDir, "main.js");
    let script = await readTextFile(entryFile);
    async function run(cmdName, args) {
        return await invoke("run_binary", {
            pluginType,
            pluginName,
            cmdName,
            args
        });
    }
    const utils = {
        tauriFetch: http.fetch,
        http,
        readFile,
        readTextFile,
        Database,
        CryptoJS,
        run,
        cacheDir, // String
        pluginDir, // String
        osType,// "Windows_NT", "Darwin", "Linux"
    }
    const entrypoint = await loadPluginEntrypoint(script, pluginType);
    if (typeof entrypoint !== 'function') {
        throw new Error(`Plugin "${pluginName}" does not expose a "${pluginType}" function`);
    }
    return [entrypoint, utils];
}
