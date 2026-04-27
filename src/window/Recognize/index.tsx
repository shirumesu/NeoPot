// @ts-nocheck
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/plugin-fs';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@heroui/react';
import { BsPinFill } from 'react-icons/bs';
import { atom, useAtom } from 'jotai';

import WindowControl from '../../components/WindowControl';
import { store } from '../../utils/store';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import ControlArea from './ControlArea';
import ImageArea from './ImageArea';
import TextArea from './TextArea';
const appWindow = getCurrentWebviewWindow()

export const pluginListAtom = atom({});

let blurTimeout = null;

const listenBlur = () => {
    return listen('tauri://blur', () => {
        if (appWindow.label === 'recognize') {
            if (blurTimeout) {
                clearTimeout(blurTimeout);
            }
            // 50ms后关闭窗口，因为在 windows 下拖动窗口时会先切换成 blur 再立即切换成 focus
            // 如果直接关闭将导致窗口无法拖动
            blurTimeout = setTimeout(async () => {
                await appWindow.close();
            }, 50);
        }
    });
};

let unlisten = listenBlur();
// 取消 blur 监听
const unlistenBlur = () => {
    unlisten.then((f) => {
        f();
    });
};

// 监听 focus 事件取消 blurTimeout 时间之内的关闭窗口
void listen('tauri://focus', () => {
    if (blurTimeout) {
        clearTimeout(blurTimeout);
    }
});

export default function Recognize() {
    const [pluginList, setPluginList] = useAtom(pluginListAtom);
    const [closeOnBlur] = useConfig('recognize_close_on_blur', false);
    const [pined, setPined] = useState(false);
    const [serviceInstanceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [pluginLoadError, setPluginLoadError] = useState(null);
    const [serviceConfigError, setServiceConfigError] = useState(null);
    const [serviceInstanceConfigMap, setServiceInstanceConfigMap] = useState({});

    const loadPluginList = async () => {
        try {
            let temp = {};
            if (await exists(`plugins/recognize`, { baseDir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/recognize`, { baseDir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/recognize/${plugin.name}/info.json`, {
                        baseDir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/recognize/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[plugin.name] = pluginInfo;
                }
            }
            setPluginLoadError(null);
            setPluginList({ ...temp });
        } catch (error) {
            console.error('Failed to load recognize plugin list:', error);
            setPluginLoadError(error instanceof Error ? error.message : String(error));
        }
    };
    const loadServiceInstanceConfigMap = async () => {
        try {
            const config = {};
            for (const serviceInstanceKey of serviceInstanceList) {
                config[serviceInstanceKey] = (await store.get(serviceInstanceKey)) ?? {};
            }
            setServiceConfigError(null);
            setServiceInstanceConfigMap({ ...config });
        } catch (error) {
            console.error('Failed to load recognize service config map:', error);
            setServiceConfigError(error instanceof Error ? error.message : String(error));
        }
    };
    useEffect(() => {
        if (serviceInstanceList !== null) {
            loadServiceInstanceConfigMap();
        }
    }, [serviceInstanceList]);

    useEffect(() => {
        loadPluginList();
    }, []);
    // 是否自动关闭窗口
    useEffect(() => {
        if (closeOnBlur !== null && !closeOnBlur) {
            unlistenBlur();
        }
    }, [closeOnBlur]);

    const hasInitError = pluginLoadError !== null || serviceConfigError !== null;
    const isRecognizeConfigReady = serviceInstanceList !== null;

    return (
        <div
            className={`bg-background h-screen ${
                osType === 'Linux' && 'rounded-[10px] border-1 border-default-100'
            }`}
        >
            <div
                data-tauri-drag-region='true'
                className='fixed top-[5px] left-[5px] right-[5px] h-[30px]'
            />
            <div className={`h-[35px] flex ${osType === 'Darwin' ? 'justify-end' : 'justify-between'}`}>
                <Button
                    isIconOnly
                    size='sm'
                    variant='flat'
                    disableAnimation
                    className='my-auto mx-[5px] bg-transparent'
                    onPress={() => {
                        if (pined) {
                            if (closeOnBlur) {
                                unlisten = listenBlur();
                            }
                            appWindow.setAlwaysOnTop(false);
                        } else {
                            unlistenBlur();
                            appWindow.setAlwaysOnTop(true);
                        }
                        setPined(!pined);
                    }}
                >
                    <BsPinFill className={`text-[20px] ${pined ? 'text-primary' : 'text-default-400'}`} />
                </Button>
                {osType !== 'Darwin' && <WindowControl />}
            </div>
            {hasInitError ? (
                <div className='m-4 rounded-medium border border-danger/30 bg-danger/10 p-4 text-sm text-danger'>
                    <div className='mb-2 font-semibold'>Recognize window initialization failed</div>
                    <pre className='whitespace-pre-wrap break-words'>{`${pluginLoadError ?? ''}${
                        pluginLoadError && serviceConfigError ? '\n' : ''
                    }${serviceConfigError ?? ''}`}</pre>
                </div>
            ) : isRecognizeConfigReady ? (
                <>
                    <div
                        className={`${
                            osType === 'Linux' ? 'h-[calc(100vh-87px)]' : 'h-[calc(100vh-85px)]'
                        } grid grid-cols-2`}
                    >
                        <ImageArea />
                        <TextArea serviceInstanceConfigMap={serviceInstanceConfigMap} />
                    </div>
                    <div className='h-[50px]'>
                        <ControlArea
                            serviceInstanceList={serviceInstanceList}
                            serviceInstanceConfigMap={serviceInstanceConfigMap}
                        />
                    </div>
                </>
            ) : (
                <div className='m-4 rounded-medium border border-default-200 bg-content1 px-4 py-3 text-sm text-default-500'>
                    Loading recognize window...
                </div>
            )}
        </div>
    );
}

