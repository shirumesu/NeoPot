// @ts-nocheck
import { useLocation, useRoutes } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { Card, Divider } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import ErrorBoundary from '../../components/ErrorBoundary';
import WindowControl from '../../components/WindowControl';
import SideBar from './components/SideBar';
import { osType } from '../../utils/env';
import { useConfig } from '../../hooks';
import routes from './routes';
import './style.css';
const appWindow = getCurrentWebviewWindow()

export default function Config() {
    const [transparent] = useConfig('transparent', true);
    const { t } = useTranslation();
    const location = useLocation();
    const page = useRoutes(routes);
    const pageTitleKey = location.pathname === '/' ? 'general' : location.pathname.slice(1);

    useEffect(() => {
        if (appWindow.label === 'config') {
            appWindow.show();
        }
    }, []);

    return (
        <div className='flex h-screen w-screen overflow-hidden'>
            <Card
                shadow='none'
                className={`${
                    transparent ? 'bg-background/90' : 'bg-content1'
                } h-screen w-[230px] shrink-0 rounded-none ${
                    osType === 'Linux' && 'rounded-l-[10px] border-1'
                } border-r-1 border-default-100 select-none cursor-default`}
            >
                <div className='h-[35px] p-[5px]'>
                    <div
                        className='w-full h-full'
                        data-tauri-drag-region='true'
                    />
                </div>
                <div className='p-[5px]'>
                    <div data-tauri-drag-region='true'>
                        <img
                            alt='pot logo'
                            src='icon.svg'
                            className='h-[60px] w-[60px] m-auto mb-[30px]'
                            draggable={false}
                        />
                    </div>
                </div>
                <SideBar />
            </Card>
            <div
                className={`bg-background h-screen min-w-0 flex-1 select-none cursor-default ${
                    osType === 'Linux' && 'rounded-r-[10px] border-1 border-l-0 border-default-100'
                }`}
            >
                <div
                    data-tauri-drag-region='true'
                    className='top-[5px] left-[235px] right-[5px] h-[30px] fixed'
                />
                <div className='h-[35px] flex justify-between'>
                    <div className='flex'>
                        <h2 className='m-auto ml-[10px]'>{t(`config.${pageTitleKey}.title`)}</h2>
                    </div>

                    <div className='flex'>{osType !== 'Darwin' && <WindowControl />}</div>
                </div>
                <Divider />
                <div
                    className={`p-[10px] overflow-y-auto ${
                        osType === 'Linux' ? 'h-[calc(100vh-38px)]' : 'h-[calc(100vh-36px)]'
                    }`}
                >
                    <ErrorBoundary fallbackTitle='Config page render failed'>
                        {page ?? (
                            <div className='rounded-medium border border-warning/30 bg-warning/10 p-4 text-sm text-warning-700'>
                                No config route matched for <code>{location.pathname}</code>.
                            </div>
                        )}
                    </ErrorBoundary>
                </div>
            </div>
        </div>
    );
}

