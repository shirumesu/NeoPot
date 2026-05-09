// @ts-nocheck
import {
    Card,
    CardBody,
    CardHeader,
    CardFooter,
    Button,
    ButtonGroup,
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Tooltip,
} from '@heroui/react';
import { BiCollapseVertical, BiExpandVertical } from 'react-icons/bi';
import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import { sendNotification } from '@tauri-apps/plugin-notification';
import React, { useEffect, useState, useRef } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { PulseLoader } from 'react-spinners';
import { TbTransformFilled } from 'react-icons/tb';
import { HiOutlineVolumeUp } from 'react-icons/hi';
import { semanticColors } from '@heroui/theme';
import toast, { Toaster } from 'react-hot-toast';
import { MdArticle, MdCode, MdContentCopy } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';
import Database from '@tauri-apps/plugin-sql';
import { GiCycle } from 'react-icons/gi';
import { useTheme } from 'next-themes';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useSpring, animated } from '@react-spring/web';
import useMeasure from 'react-use-measure';

import * as builtinCollectionServices from '../../../../services/collection';
import { sourceLanguageAtom, targetLanguageAtom } from '../LanguageArea';
import { useConfig, useToastStyle, useVoice } from '../../../../hooks';
import { sourceTextAtom, detectLanguageAtom } from '../SourceArea';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import * as builtinTtsServices from '../../../../services/tts';

import { info, error as logError } from '@tauri-apps/plugin-log';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getDisplayInstanceName,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../utils/service_instance';

let translateID = [];

const MARKDOWN_PATTERNS = [
    /^#{1,6}\s+\S/m,
    /^>\s+\S/m,
    /^[-*+]\s+\S/m,
    /^\d+\.\s+\S/m,
    /^```/m,
    /`[^`\n]+`/,
    /\[[^\]]+\]\([^)]+\)/,
    /^-{3,}\s*$/m,
    /^\|.+\|\s*$/m,
];

function isMarkdownLike(value) {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    if (text.length < 3) return false;

    return MARKDOWN_PATTERNS.some((pattern) => pattern.test(text));
}

function MarkdownResult({ value, appFontSize }) {
    return (
        <div
            className='select-text break-words text-default-700'
            style={{ fontSize: `${appFontSize}px` }}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ children }) => <h1 className='mb-2 text-[1.35em] font-semibold'>{children}</h1>,
                    h2: ({ children }) => <h2 className='mb-2 mt-3 text-[1.2em] font-semibold'>{children}</h2>,
                    h3: ({ children }) => <h3 className='mb-1.5 mt-3 text-[1.1em] font-semibold'>{children}</h3>,
                    h4: ({ children }) => <h4 className='mb-1.5 mt-2 font-semibold'>{children}</h4>,
                    p: ({ children }) => <p className='mb-2 leading-relaxed last:mb-0'>{children}</p>,
                    ul: ({ children }) => <ul className='mb-2 list-disc space-y-1 pl-5'>{children}</ul>,
                    ol: ({ children }) => <ol className='mb-2 list-decimal space-y-1 pl-5'>{children}</ol>,
                    li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
                    blockquote: ({ children }) => (
                        <blockquote className='mb-2 border-l-2 border-default-300 pl-3 text-default-500'>
                            {children}
                        </blockquote>
                    ),
                    a: ({ href, children }) => (
                        <a
                            href={href}
                            target='_blank'
                            rel='noreferrer'
                            className='text-primary underline underline-offset-2'
                        >
                            {children}
                        </a>
                    ),
                    code: ({ className, children }) => (
                        <code
                            className={`${className ?? ''} rounded-small bg-default-100 px-1 py-0.5 font-mono text-[0.92em]`}
                        >
                            {children}
                        </code>
                    ),
                    pre: ({ children }) => (
                        <pre className='mb-2 overflow-x-auto rounded-small bg-default-100 p-2 leading-relaxed [&_code]:block [&_code]:bg-transparent [&_code]:p-0'>
                            {children}
                        </pre>
                    ),
                    hr: () => <hr className='my-3 border-default-200' />,
                    table: ({ children }) => (
                        <div className='mb-2 overflow-x-auto'>
                            <table className='min-w-full border-collapse text-left'>{children}</table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className='border border-default-200 bg-default-100 px-2 py-1 font-semibold'>{children}</th>
                    ),
                    td: ({ children }) => <td className='border border-default-200 px-2 py-1'>{children}</td>,
                }}
            >
                {value}
            </ReactMarkdown>
        </div>
    );
}

export default function TargetArea(props) {
    const { index, name, translateServiceInstanceList, pluginList, serviceInstanceConfigMap } = props;

    const [currentTranslateServiceInstanceKey, setCurrentTranslateServiceInstanceKey] = useState(name);
    function getInstanceName(instanceKey, serviceNameSupplier) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    const [appFontSize] = useConfig('app_font_size', 16);
    const [collectionServiceList] = useConfig('collection_service_list', []);
    const [ttsServiceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [translateSecondLanguage] = useConfig('translate_second_language', 'en');
    const [historyDisable] = useConfig('history_disable', false);
    const [isLoading, setIsLoading] = useState(false);
    const [hide, setHide] = useState(true);

    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [resultViewMode, setResultViewMode] = useState(null);

    const sourceText = useAtomValue(sourceTextAtom);
    const sourceLanguage = useAtomValue(sourceLanguageAtom);
    const targetLanguage = useAtomValue(targetLanguageAtom);
    const [autoCopy] = useConfig('translate_auto_copy', 'disable');
    const [hideWindow] = useConfig('translate_hide_window', false);
    const [clipboardMonitor] = useConfig('clipboard_monitor', false);

    const detectLanguage = useAtomValue(detectLanguageAtom);
    const [ttsPluginInfo, setTtsPluginInfo] = useState();
    const { t } = useTranslation();
    const textAreaRef = useRef();
    const toastStyle = useToastStyle();
    const speak = useVoice();
    const theme = useTheme();

    useEffect(() => {
        if (error) {
            logError(`[${currentTranslateServiceInstanceKey}]happened error: ` + error);
        }
    }, [error]);

    // listen to translation
    useEffect(() => {
        setResult('');
        setError('');
        setResultViewMode(null);
        if (
            sourceText.trim() !== '' &&
            sourceLanguage &&
            targetLanguage &&
            autoCopy !== null &&
            hideWindow !== null &&
            clipboardMonitor !== null
        ) {
            if (autoCopy === 'source' && !clipboardMonitor) {
                writeText(sourceText).then(() => {
                    if (hideWindow) {
                        sendNotification({ title: t('common.write_clipboard'), body: sourceText });
                    }
                });
            }
            translate();
        }
    }, [
        sourceText,
        sourceLanguage,
        targetLanguage,
        autoCopy,
        hideWindow,
        currentTranslateServiceInstanceKey,
        clipboardMonitor,
        serviceInstanceConfigMap,
    ]);

    // todo: history panel use service instance key
    const addToHistory = async (text, source, target, serviceInstanceKey, result) => {
        const db = await Database.load('sqlite:history.db');

        await db
            .execute(
                'INSERT into history (text, source, target, service, result, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
                [text, source, target, serviceInstanceKey, result, Date.now()]
            )
            .then(
                (v) => {
                    db.close();
                },
                (e) => {
                    db.execute(
                        'CREATE TABLE history(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,service TEXT NOT NULL, result TEXT NOT NULL,timestamp INTEGER NOT NULL)'
                    ).then(() => {
                        db.close();
                        addToHistory(text, source, target, serviceInstanceKey, result);
                    });
                }
            );
    };

    function invokeOnce(fn) {
        let isInvoke = false;

        return (...args) => {
            if (isInvoke) {
                return;
            } else {
                fn(...args);
                isInvoke = true;
            }
        };
    }

    const translate = async () => {
        let id = nanoid();
        translateID[index] = id;

        const translateServiceName = getServiceName(currentTranslateServiceInstanceKey);

        if (whetherPluginService(currentTranslateServiceInstanceKey)) {
            const pluginInfo = pluginList['translate'][translateServiceName];
            if (sourceLanguage in pluginInfo.language && targetLanguage in pluginInfo.language) {
                let newTargetLanguage = targetLanguage;
                if (sourceLanguage === 'auto' && targetLanguage === detectLanguage) {
                    newTargetLanguage = translateSecondLanguage;
                }
                setIsLoading(true);
                setHide(true);
                const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                if (instanceConfig === undefined) {
                    setIsLoading(false);
                    return;
                }
                instanceConfig['enable'] = 'true';
                const setHideOnce = invokeOnce(setHide);
                let [func, utils] = await invoke_plugin('translate', translateServiceName);
                func(sourceText.trim(), pluginInfo.language[sourceLanguage], pluginInfo.language[newTargetLanguage], {
                    config: instanceConfig,
                    detect: detectLanguage,
                    setResult: (v) => {
                        if (translateID[index] !== id) return;
                        setResult(v);
                        setHideOnce(false);
                    },
                    utils,
                }).then(
                    (v) => {
                        info(`[${currentTranslateServiceInstanceKey}]resolve:` + v);
                        if (translateID[index] !== id) return;
                        setResult(typeof v === 'string' ? v.trim() : v);
                        setIsLoading(false);
                        if (v !== '') {
                            setHideOnce(false);
                        }
                        if (!historyDisable) {
                            addToHistory(
                                sourceText.trim(),
                                detectLanguage,
                                newTargetLanguage,
                                translateServiceName,
                                typeof v === 'string' ? v.trim() : v
                            );
                        }
                        if (index === 0 && !clipboardMonitor) {
                            switch (autoCopy) {
                                case 'target':
                                    writeText(v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({ title: t('common.write_clipboard'), body: v });
                                        }
                                    });
                                    break;
                                case 'source_target':
                                    writeText(sourceText.trim() + '\n\n' + v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({
                                                title: t('common.write_clipboard'),
                                                body: sourceText.trim() + '\n\n' + v,
                                            });
                                        }
                                    });
                                    break;
                                default:
                                    break;
                            }
                        }
                    },
                    (e) => {
                        info(`[${currentTranslateServiceInstanceKey}]reject:` + e);
                        if (translateID[index] !== id) return;
                        setError(e.toString());
                        setIsLoading(false);
                    }
                );
            } else {
                setError('Language not supported');
            }
        } else {
            const LanguageEnum = builtinServices[translateServiceName].Language;
            if (sourceLanguage in LanguageEnum && targetLanguage in LanguageEnum) {
                let newTargetLanguage = targetLanguage;
                if (sourceLanguage === 'auto' && targetLanguage === detectLanguage) {
                    newTargetLanguage = translateSecondLanguage;
                }
                setIsLoading(true);
                setHide(true);
                const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                if (instanceConfig === undefined) {
                    setIsLoading(false);
                    return;
                }
                const setHideOnce = invokeOnce(setHide);
                builtinServices[translateServiceName]
                    .translate(sourceText.trim(), LanguageEnum[sourceLanguage], LanguageEnum[newTargetLanguage], {
                        config: instanceConfig,
                        detect: detectLanguage,
                        setResult: (v) => {
                            if (translateID[index] !== id) return;
                            setResult(v);
                            setHideOnce(false);
                        },
                    })
                    .then(
                        (v) => {
                            info(`[${currentTranslateServiceInstanceKey}]resolve:` + v);
                            if (translateID[index] !== id) return;
                            setResult(typeof v === 'string' ? v.trim() : v);
                            setIsLoading(false);
                            if (v !== '') {
                                setHideOnce(false);
                            }
                            if (!historyDisable) {
                                addToHistory(
                                    sourceText.trim(),
                                    detectLanguage,
                                    newTargetLanguage,
                                    translateServiceName,
                                    typeof v === 'string' ? v.trim() : v
                                );
                            }
                            if (index === 0 && !clipboardMonitor) {
                                switch (autoCopy) {
                                    case 'target':
                                        writeText(v).then(() => {
                                            if (hideWindow) {
                                                sendNotification({ title: t('common.write_clipboard'), body: v });
                                            }
                                        });
                                        break;
                                    case 'source_target':
                                        writeText(sourceText.trim() + '\n\n' + v).then(() => {
                                            if (hideWindow) {
                                                sendNotification({
                                                    title: t('common.write_clipboard'),
                                                    body: sourceText.trim() + '\n\n' + v,
                                                });
                                            }
                                        });
                                        break;
                                    default:
                                        break;
                                }
                            }
                        },
                        (e) => {
                            info(`[${currentTranslateServiceInstanceKey}]reject:` + e);
                            if (translateID[index] !== id) return;
                            setError(e.toString());
                            setIsLoading(false);
                        }
                    );
            } else {
                setError('Language not supported');
            }
        }
    };

    // hide empty textarea
    useEffect(() => {
        if (textAreaRef.current !== null) {
            textAreaRef.current.style.height = '0px';
            if (result !== '') {
                textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
            }
        }
    }, [result, resultViewMode]);

    // refresh tts config
    useEffect(() => {
        if (ttsServiceList && getServiceSouceType(ttsServiceList[0]) === ServiceSourceType.PLUGIN) {
            readTextFile(`plugins/tts/${getServiceName(ttsServiceList[0])}/info.json`, {
                baseDir: BaseDirectory.AppConfig,
            }).then((infoStr) => {
                setTtsPluginInfo(JSON.parse(infoStr));
            });
        }
    }, [ttsServiceList]);

    // handle tts speak
    const handleSpeak = async () => {
        const instanceKey = ttsServiceList[0];
        if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
            const pluginConfig = serviceInstanceConfigMap[instanceKey];
            if (!(targetLanguage in ttsPluginInfo.language)) {
                throw new Error('Language not supported');
            }
            let [func, utils] = await invoke_plugin('tts', getServiceName(instanceKey));
            let data = await func(result, ttsPluginInfo.language[targetLanguage], {
                config: pluginConfig,
                utils,
            });
            speak(data);
        } else {
            if (!(targetLanguage in builtinTtsServices[getServiceName(instanceKey)].Language)) {
                throw new Error('Language not supported');
            }
            const instanceConfig = serviceInstanceConfigMap[instanceKey];
            let data = await builtinTtsServices[getServiceName(instanceKey)].tts(
                result,
                builtinTtsServices[getServiceName(instanceKey)].Language[targetLanguage],
                {
                    config: instanceConfig,
                }
            );
            speak(data);
        }
    };

    const [boundRef, bounds] = useMeasure({ scroll: true });
    const springs = useSpring({
        from: { height: 0 },
        to: { height: hide ? 0 : bounds.height },
    });
    const canPreviewMarkdown = typeof result === 'string' && result !== '' && isMarkdownLike(result);
    const activeResultViewMode = resultViewMode ?? (canPreviewMarkdown ? 'markdown' : 'source');

    return (
        <Card
            shadow='none'
            className='rounded-[10px]'
        >
            <Toaster />
            <CardHeader
                className={`flex justify-between py-1 px-0 bg-content2 h-[30px] ${hide ? 'rounded-[10px]' : 'rounded-t-[10px]'}`}
            >
                {/* current service instance and available service instance to change */}
                <div className='flex'>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button
                                size='sm'
                                variant='solid'
                                className='bg-transparent'
                                startContent={
                                    whetherPluginService(currentTranslateServiceInstanceKey) ? (
                                        <img
                                            src={
                                                pluginList['translate'][
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                ].icon
                                            }
                                            className='h-[20px] my-auto'
                                        />
                                    ) : (
                                        <img
                                            src={
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)].info
                                                    .icon
                                            }
                                            className='h-[20px] my-auto'
                                        />
                                    )
                                }
                            >
                                {whetherPluginService(currentTranslateServiceInstanceKey) ? (
                                    <div className='my-auto'>{`${getInstanceName(currentTranslateServiceInstanceKey, () => pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)].display)} `}</div>
                                ) : (
                                    <div className='my-auto'>
                                        {getInstanceName(currentTranslateServiceInstanceKey, () =>
                                            t(
                                                `services.translate.${getServiceName(currentTranslateServiceInstanceKey)}.title`
                                            )
                                        )}
                                    </div>
                                )}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            aria-label='app language'
                            className='max-h-[40vh] overflow-y-auto'
                            onAction={(key) => {
                                setCurrentTranslateServiceInstanceKey(key);
                            }}
                        >
                            {translateServiceInstanceList.map((instanceKey) => {
                                return (
                                    <DropdownItem
                                        key={instanceKey}
                                        startContent={
                                            whetherPluginService(instanceKey) ? (
                                                <img
                                                    src={pluginList['translate'][getServiceName(instanceKey)].icon}
                                                    className='h-[20px] my-auto'
                                                />
                                            ) : (
                                                <img
                                                    src={builtinServices[getServiceName(instanceKey)].info.icon}
                                                    className='h-[20px] my-auto'
                                                />
                                            )
                                        }
                                    >
                                        {whetherPluginService(instanceKey) ? (
                                            <div className='my-auto'>{`${getInstanceName(instanceKey, () => pluginList['translate'][getServiceName(instanceKey)].display)} `}</div>
                                        ) : (
                                            <div className='my-auto'>
                                                {getInstanceName(instanceKey, () =>
                                                    t(`services.translate.${getServiceName(instanceKey)}.title`)
                                                )}
                                            </div>
                                        )}
                                    </DropdownItem>
                                );
                            })}
                        </DropdownMenu>
                    </Dropdown>
                    <PulseLoader
                        loading={isLoading}
                        color={theme === 'dark' ? semanticColors.dark.default[500] : semanticColors.light.default[500]}
                        size={8}
                        cssOverride={{
                            display: 'inline-block',
                            margin: 'auto',
                            marginLeft: '20px',
                        }}
                    />
                </div>
                {/* content collapse */}
                <div className='flex'>
                    <Button
                        size='sm'
                        isIconOnly
                        variant='light'
                        className='h-[20px] w-[20px]'
                        onPress={() => setHide(!hide)}
                    >
                        {hide ? (
                            <BiExpandVertical className='text-[16px]' />
                        ) : (
                            <BiCollapseVertical className='text-[16px]' />
                        )}
                    </Button>
                </div>
            </CardHeader>
            <animated.div style={{ ...springs }}>
                <div ref={boundRef}>
                    {/* result content */}
                    <CardBody className={`p-[12px] pb-0 ${hide && 'h-0 p-0'}`}>
                        {typeof result === 'string' ? (
                            activeResultViewMode === 'markdown' && canPreviewMarkdown ? (
                                <MarkdownResult
                                    value={result}
                                    appFontSize={appFontSize}
                                />
                            ) : (
                                <textarea
                                    ref={textAreaRef}
                                    className={`text-[${appFontSize}px] h-0 w-full resize-none overflow-hidden bg-transparent select-text outline-none`}
                                    readOnly
                                    value={result}
                                />
                            )
                        ) : (
                            <div>
                                {result['pronunciations'] &&
                                    result['pronunciations'].map((pronunciation) => {
                                        return (
                                            <div key={nanoid()}>
                                                {pronunciation['region'] && (
                                                    <span
                                                        className={`text-[${appFontSize}px] mr-[12px] text-default-500`}
                                                    >
                                                        {pronunciation['region']}
                                                    </span>
                                                )}
                                                {pronunciation['symbol'] && (
                                                    <span
                                                        className={`text-[${appFontSize}px] mr-[12px] text-default-500`}
                                                    >
                                                        {pronunciation['symbol']}
                                                    </span>
                                                )}
                                                {pronunciation['voice'] && pronunciation['voice'] !== '' && (
                                                    <HiOutlineVolumeUp
                                                        className={`text-[${appFontSize}px] inline-block my-auto cursor-pointer`}
                                                        onClick={() => {
                                                            speak(pronunciation['voice']);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                {result['explanations'] &&
                                    result['explanations'].map((explanations) => {
                                        return (
                                            <div key={nanoid()}>
                                                {explanations['explains'] &&
                                                    explanations['explains'].map((explain, index) => {
                                                        return (
                                                            <span key={nanoid()}>
                                                                {index === 0 ? (
                                                                    <>
                                                                        <span
                                                                            className={`text-[${appFontSize - 2}px] text-default-500 mr-[12px]`}
                                                                        >
                                                                            {explanations['trait']}
                                                                        </span>
                                                                        <span
                                                                            className={`font-bold text-[${appFontSize}px] select-text`}
                                                                        >
                                                                            {explain}
                                                                        </span>
                                                                        <br />
                                                                    </>
                                                                ) : (
                                                                    <span
                                                                        className={`text-[${appFontSize - 2}px] text-default-500 select-text mr-1`}
                                                                        key={nanoid()}
                                                                    >
                                                                        {explain}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        );
                                    })}
                                <br />
                                {result['associations'] &&
                                    result['associations'].map((association) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className={`text-[${appFontSize}px] text-default-500`}>
                                                    {association}
                                                </span>
                                            </div>
                                        );
                                    })}
                                {result['sentence'] &&
                                    result['sentence'].map((sentence, index) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className={`text-[${appFontSize - 2}px] mr-[12px]`}>
                                                    {index + 1}.
                                                </span>
                                                <>
                                                    {sentence['source'] && (
                                                        <span
                                                            className={`text-[${appFontSize}px] select-text`}
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['source'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                                <>
                                                    {sentence['target'] && (
                                                        <div
                                                            className={`text-[${appFontSize}px] select-text text-default-500`}
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['target'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        {error !== '' ? (
                            error.split('\n').map((v) => {
                                return (
                                    <p
                                        key={v}
                                        className={`text-[${appFontSize}px] text-red-500`}
                                    >
                                        {v}
                                    </p>
                                );
                            })
                        ) : (
                            <></>
                        )}
                    </CardBody>
                    <CardFooter
                        className={`bg-content1 rounded-none rounded-b-[10px] flex px-[12px] p-[5px] ${hide && 'hidden'}`}
                    >
                        <ButtonGroup>
                            {/* markdown preview toggle */}
                            <Tooltip
                                content={
                                    activeResultViewMode === 'markdown'
                                        ? t('translate.show_source')
                                        : t('translate.show_preview')
                                }
                            >
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    className={`${!canPreviewMarkdown && 'hidden'}`}
                                    isDisabled={!canPreviewMarkdown}
                                    onPress={() => {
                                        setResultViewMode(activeResultViewMode === 'markdown' ? 'source' : 'markdown');
                                    }}
                                >
                                    {activeResultViewMode === 'markdown' ? (
                                        <MdCode className='text-[16px]' />
                                    ) : (
                                        <MdArticle className='text-[16px]' />
                                    )}
                                </Button>
                            </Tooltip>
                            {/* speak button */}
                            <Tooltip content={t('translate.speak')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={() => {
                                        handleSpeak().catch((e) => {
                                            toast.error(e.toString(), { style: toastStyle });
                                        });
                                    }}
                                >
                                    <HiOutlineVolumeUp className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* copy button */}
                            <Tooltip content={t('translate.copy')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={() => {
                                        writeText(result);
                                    }}
                                >
                                    <MdContentCopy className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* translate back button */}
                            <Tooltip content={t('translate.translate_back')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    isDisabled={typeof result !== 'string' || result === ''}
                                    onPress={async () => {
                                        setError('');
                                        setResultViewMode(null);
                                        let newTargetLanguage = sourceLanguage;
                                        if (sourceLanguage === 'auto') {
                                            newTargetLanguage = detectLanguage;
                                        }
                                        let newSourceLanguage = targetLanguage;
                                        if (sourceLanguage === 'auto') {
                                            newSourceLanguage = 'auto';
                                        }
                                        if (whetherPluginService(currentTranslateServiceInstanceKey)) {
                                            const pluginInfo =
                                                pluginList['translate'][
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                ];
                                            if (
                                                newSourceLanguage in pluginInfo.language &&
                                                newTargetLanguage in pluginInfo.language
                                            ) {
                                                setIsLoading(true);
                                                setHide(true);
                                                const instanceConfig =
                                                    serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                                                instanceConfig['enable'] = 'true';
                                                const setHideOnce = invokeOnce(setHide);
                                                let [func, utils] = await invoke_plugin(
                                                    'translate',
                                                    getServiceName(currentTranslateServiceInstanceKey)
                                                );
                                                func(
                                                    result.trim(),
                                                    pluginInfo.language[newSourceLanguage],
                                                    pluginInfo.language[newTargetLanguage],
                                                    {
                                                        config: instanceConfig,
                                                        detect: detectLanguage,
                                                        setResult: (v) => {
                                                            setResult(v);
                                                            setHideOnce(false);
                                                        },
                                                        utils,
                                                    }
                                                ).then(
                                                    (v) => {
                                                        if (v === result) {
                                                            setResult(v + ' ');
                                                        } else {
                                                            setResult(v.trim());
                                                        }
                                                        setIsLoading(false);
                                                        if (v !== '') {
                                                            setHideOnce(false);
                                                        }
                                                    },
                                                    (e) => {
                                                        setError(e.toString());
                                                        setIsLoading(false);
                                                    }
                                                );
                                            } else {
                                                setError('Language not supported');
                                            }
                                        } else {
                                            const LanguageEnum =
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)]
                                                    .Language;
                                            if (
                                                newSourceLanguage in LanguageEnum &&
                                                newTargetLanguage in LanguageEnum
                                            ) {
                                                setIsLoading(true);
                                                setHide(true);
                                                const instanceConfig =
                                                    serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                                                const setHideOnce = invokeOnce(setHide);
                                                builtinServices[getServiceName(currentTranslateServiceInstanceKey)]
                                                    .translate(
                                                        result.trim(),
                                                        LanguageEnum[newSourceLanguage],
                                                        LanguageEnum[newTargetLanguage],
                                                        {
                                                            config: instanceConfig,
                                                            detect: newSourceLanguage,
                                                            setResult: (v) => {
                                                                setResult(v);
                                                                setHideOnce(false);
                                                            },
                                                        }
                                                    )
                                                    .then(
                                                        (v) => {
                                                            if (v === result) {
                                                                setResult(v + ' ');
                                                            } else {
                                                                setResult(v.trim());
                                                            }
                                                            setIsLoading(false);
                                                            if (v !== '') {
                                                                setHideOnce(false);
                                                            }
                                                        },
                                                        (e) => {
                                                            setError(e.toString());
                                                            setIsLoading(false);
                                                        }
                                                    );
                                            } else {
                                                setError('Language not supported');
                                            }
                                        }
                                    }}
                                >
                                    <TbTransformFilled className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* error retry button */}
                            <Tooltip content={t('translate.retry')}>
                                <Button
                                    isIconOnly
                                    variant='light'
                                    size='sm'
                                    className={`${error === '' && 'hidden'}`}
                                    onPress={() => {
                                        setError('');
                                        setResult('');
                                        setResultViewMode(null);
                                        translate();
                                    }}
                                >
                                    <GiCycle className='text-[16px]' />
                                </Button>
                            </Tooltip>
                            {/* available collection service instance */}
                            {collectionServiceList &&
                                collectionServiceList.map((collectionServiceInstanceName) => {
                                    return (
                                        <Button
                                            key={collectionServiceInstanceName}
                                            isIconOnly
                                            variant='light'
                                            size='sm'
                                            onPress={async () => {
                                                if (
                                                    getServiceSouceType(collectionServiceInstanceName) ===
                                                    ServiceSourceType.PLUGIN
                                                ) {
                                                    const pluginConfig =
                                                        serviceInstanceConfigMap[collectionServiceInstanceName];
                                                    let [func, utils] = await invoke_plugin(
                                                        'collection',
                                                        getServiceName(collectionServiceInstanceName)
                                                    );
                                                    func(sourceText.trim(), result.toString(), {
                                                        config: pluginConfig,
                                                        utils,
                                                    }).then(
                                                        (_) => {
                                                            toast.success(t('translate.add_collection_success'), {
                                                                style: toastStyle,
                                                            });
                                                        },
                                                        (e) => {
                                                            toast.error(e.toString(), { style: toastStyle });
                                                        }
                                                    );
                                                } else {
                                                    const instanceConfig =
                                                        serviceInstanceConfigMap[collectionServiceInstanceName];
                                                    builtinCollectionServices[
                                                        getServiceName(collectionServiceInstanceName)
                                                    ]
                                                        .collection(sourceText, result, {
                                                            config: instanceConfig,
                                                        })
                                                        .then(
                                                            (_) => {
                                                                toast.success(t('translate.add_collection_success'), {
                                                                    style: toastStyle,
                                                                });
                                                            },
                                                            (e) => {
                                                                toast.error(e.toString(), { style: toastStyle });
                                                            }
                                                        );
                                                }
                                            }}
                                        >
                                            <img
                                                src={
                                                    getServiceSouceType(collectionServiceInstanceName) ===
                                                    ServiceSourceType.PLUGIN
                                                        ? pluginList['collection'][
                                                              getServiceName(collectionServiceInstanceName)
                                                          ].icon
                                                        : builtinCollectionServices[
                                                              getServiceName(collectionServiceInstanceName)
                                                          ].info.icon
                                                }
                                                className='h-[16px] w-[16px]'
                                            />
                                        </Button>
                                    );
                                })}
                        </ButtonGroup>
                    </CardFooter>
                </div>
            </animated.div>
        </Card>
    );
}
