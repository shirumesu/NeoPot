import { VscChromeClose, VscChromeMinimize, VscChromeMaximize, VscChromeRestore } from 'react-icons/vsc';
import React, { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@heroui/react';

import { osType } from '../../utils/env';
import './style.css';
const appWindow = getCurrentWebviewWindow();

export default function WindowControl() {
    const [isMax, setIsMax] = useState(false);

    useEffect(() => {
        void listen('tauri://resize', async () => {
            if (await appWindow.isMaximized()) {
                setIsMax(true);
            } else {
                setIsMax(false);
            }
        });
    }, []);

    return (
        <div>
            <Button
                isIconOnly
                variant='light'
                className='w-[35px] h-[35px] rounded-none'
                onPress={() => appWindow.minimize()}
            >
                <VscChromeMinimize className='text-[16px]' />
            </Button>
            <Button
                isIconOnly
                variant='light'
                className='w-[35px] h-[35px] rounded-none'
                onPress={() => {
                    if (isMax) {
                        void appWindow.unmaximize();
                    } else {
                        void appWindow.maximize();
                    }
                }}
            >
                {isMax ? (
                    <VscChromeRestore className='text-[16px]' />
                ) : (
                    <VscChromeMaximize className='text-[16px]' />
                )}
            </Button>
            <Button
                isIconOnly
                variant='light'
                className={`w-[35px] h-[35px] rounded-none close-button ${osType === 'Linux' && 'rounded-tr-[10px]'}`}
                onPress={() => void appWindow.close()}
            >
                <VscChromeClose className='text-[16px]' />
            </Button>
        </div>
    );
}
