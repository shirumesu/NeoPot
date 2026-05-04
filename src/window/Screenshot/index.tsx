// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { currentMonitor } from '@tauri-apps/api/window';
import { convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { warn, info } from '@tauri-apps/plugin-log';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
const appWindow = getCurrentWebviewWindow()

export default function Screenshot() {
    const [imgurl, setImgurl] = useState('');
    const [error, setError] = useState('');
    const [isMoved, setIsMoved] = useState(false);
    const [isDown, setIsDown] = useState(false);
    const [mouseDownX, setMouseDownX] = useState(0);
    const [mouseDownY, setMouseDownY] = useState(0);
    const [mouseMoveX, setMouseMoveX] = useState(0);
    const [mouseMoveY, setMouseMoveY] = useState(0);

    const imgRef = useRef();

    const captureScreenshot = async () => {
        try {
            setError('');
            const monitor = await currentMonitor();
            const position = monitor?.position ?? { x: 0, y: 0 };
            await invoke('screenshot', { x: position.x, y: position.y });
            const appCacheDirPath = await appCacheDir();
            const filePath = await join(appCacheDirPath, 'pot_screenshot.png');
            setImgurl(`${convertFileSrc(filePath)}?t=${Date.now()}`);
            await appWindow.show();
            await appWindow.setFocus();
        } catch (e) {
            setError(e.toString());
            await appWindow.show();
            await appWindow.setFocus();
        }
    };

    useEffect(() => {
        void captureScreenshot();
        const unlisten = listen('capture_screenshot', () => {
            void captureScreenshot();
        });

        return () => {
            void unlisten.then((f) => f());
        };
    }, []);

    return (
        <>
            {error && (
                <div className='fixed inset-0 z-20 bg-background p-4 text-sm text-danger'>
                    {error}
                </div>
            )}
            <img
                ref={imgRef}
                className='fixed top-0 left-0 w-full select-none'
                src={imgurl}
                draggable={false}
                onLoad={() => {
                    if (imgurl !== '' && imgRef.current.complete) {
                        void appWindow.show();
                        void appWindow.setFocus();
                        void appWindow.setResizable(false);
                    }
                }}
            />
            <div
                className={`fixed bg-[#2080f020] border border-solid border-sky-500 ${!isMoved && 'hidden'}`}
                style={{
                    top: Math.min(mouseDownY, mouseMoveY),
                    left: Math.min(mouseDownX, mouseMoveX),
                    bottom: window.innerHeight - Math.max(mouseDownY, mouseMoveY),
                    right: window.innerWidth - Math.max(mouseDownX, mouseMoveX),
                }}
            />
            <div
                className='fixed top-0 left-0 bottom-0 right-0 cursor-crosshair select-none'
                onMouseDown={(e) => {
                    if (e.buttons === 1) {
                        setIsDown(true);
                        setMouseDownX(e.clientX);
                        setMouseDownY(e.clientY);
                        info(`[Screenshot] mouseDown: clientX=${e.clientX}, clientY=${e.clientY}`);
                    } else {
                        void appWindow.close();
                    }
                }}
                onMouseMove={(e) => {
                    if (isDown) {
                        setIsMoved(true);
                        setMouseMoveX(e.clientX);
                        setMouseMoveY(e.clientY);
                    }
                }}
                onMouseUp={async (e) => {
                    const monitor = await currentMonitor();
                    const dpi = monitor.size.width / window.innerWidth;
                    info(`[Screenshot] mouseUp: clientX=${e.clientX}, clientY=${e.clientY}, mouseDownX=${mouseDownX}, mouseDownY=${mouseDownY}, monitorWidth=${monitor.size.width}, winWidth=${window.innerWidth}, dpi=${dpi}, isMoved=${isMoved}`);
                    appWindow.hide();
                    setIsDown(false);
                    setIsMoved(false);
                    const left = Math.floor(Math.min(mouseDownX, e.clientX) * dpi);
                    const top = Math.floor(Math.min(mouseDownY, e.clientY) * dpi);
                    const right = Math.floor(Math.max(mouseDownX, e.clientX) * dpi);
                    const bottom = Math.floor(Math.max(mouseDownY, e.clientY) * dpi);
                    const width = right - left;
                    const height = bottom - top;
                    info(`[Screenshot] crop: left=${left}, top=${top}, width=${width}, height=${height}`);
                    if (width <= 0 || height <= 0) {
                        warn('Screenshot area is too small');
                        await appWindow.close();
                    } else {
                        try {
                            await invoke('cut_image', { left, top, width, height });
                            await appWindow.emit('success');
                            await appWindow.close();
                        } catch (error) {
                            setError(error.toString());
                            await appWindow.show();
                            await appWindow.setFocus();
                        }
                    }
                }}
            />
        </>
    );
}

