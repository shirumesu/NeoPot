// @ts-nocheck
import {
    Input,
    Button,
    Switch,
    Textarea,
    Card,
    CardBody,
    Link,
    Tooltip,
    Progress,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from '@heroui/react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { MdDeleteOutline } from 'react-icons/md';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { openUrl as open } from '@tauri-apps/plugin-opener';
import React, { useEffect, useState } from 'react';

import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { getModels as getOllamaModels, pullModel as pullOllamaModel, translate } from './index';
import { Language } from './index';

const THINKING_MODE_DEFAULT = 'default';
const THINKING_MODE_ON = 'on';
const THINKING_MODE_OFF = 'off';
const DEFAULT_MODEL = 'gemma4:e2b';
const LEGACY_DEFAULT_MODEL = 'gemma:2b';

const DEFAULT_PROMPT_LIST = [
    {
        role: 'system',
        content:
            'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
    },
    { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
];

function normalizeHost(requestPath) {
    let normalized = requestPath?.trim() || 'http://localhost:11434';

    if (!/^https?:\/\/.+/i.test(normalized)) {
        normalized = `http://${normalized}`;
    }

    return normalized.replace(/\/+$/, '');
}

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [serviceConfig, setServiceConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.ollama.title'),
            stream: true,
            model: DEFAULT_MODEL,
            requestPath: 'http://localhost:11434',
            temperature: '',
            topP: '',
            topK: '',
            thinkingMode: THINKING_MODE_OFF,
            promptList: DEFAULT_PROMPT_LIST,
        },
        { sync: false }
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [pullingStatus, setPullingStatus] = useState('');
    const [installedModels, setInstalledModels] = useState(null);

    const toastStyle = useToastStyle();

    if (serviceConfig) {
        let changed = false;
        const nextConfig = { ...serviceConfig };

        if (nextConfig.promptList === undefined) {
            nextConfig.promptList = DEFAULT_PROMPT_LIST;
            changed = true;
        }
        if (nextConfig.temperature === undefined) {
            nextConfig.temperature = '';
            changed = true;
        }
        if (nextConfig.topP === undefined) {
            nextConfig.topP = '';
            changed = true;
        }
        if (nextConfig.topK === undefined) {
            nextConfig.topK = '';
            changed = true;
        }
        if (nextConfig.thinkingMode === undefined) {
            nextConfig.thinkingMode = THINKING_MODE_DEFAULT;
            changed = true;
        }

        if (changed) {
            setServiceConfig(nextConfig);
        }
    }

    async function getModels() {
        try {
            const list = await getOllamaModels(normalizeHost(serviceConfig.requestPath));
            setInstalledModels(list);
            const models = list.models?.map((model) => model.name) ?? [];
            if (
                serviceConfig.model === LEGACY_DEFAULT_MODEL &&
                models.length > 0 &&
                !models.includes(LEGACY_DEFAULT_MODEL)
            ) {
                setServiceConfig({
                    ...serviceConfig,
                    model: models.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : models[0],
                });
            }
        } catch {
            setInstalledModels(null);
        }
    }

    async function pullModel() {
        setIsPulling(true);
        setProgress(0);
        setPullingStatus(serviceConfig.model);
        try {
            await pullOllamaModel(normalizeHost(serviceConfig.requestPath), serviceConfig.model);
            await getModels();
        } catch (e) {
            toast.error(e.toString(), { style: toastStyle });
        } finally {
            setProgress(0);
            setPullingStatus('');
            setIsPulling(false);
        }
    }

    useEffect(() => {
        if (serviceConfig !== null) {
            getModels();
        }
    }, [serviceConfig?.requestPath]);

    return (
        serviceConfig !== null && (
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setServiceConfig(serviceConfig, true);
                    updateServiceList(instanceKey);
                    onClose();
                }}
            >
                <Toaster />
                <div className='config-item'>
                    <Input
                        label={t('services.instance_name')}
                        labelPlacement='outside-left'
                        value={serviceConfig[INSTANCE_NAME_CONFIG_KEY]}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />
                </div>
                {installedModels === null && (
                    <Card
                        isBlurred
                        className='border-none bg-danger/20 dark:bg-danger/10'
                        shadow='sm'
                    >
                        <CardBody>
                            <div>
                                {t('services.translate.ollama.install_ollama')}
                                <br />
                                <Link
                                    isExternal
                                    href='https://ollama.com/download'
                                    color='primary'
                                >
                                    {t('services.translate.ollama.install_ollama_link')}
                                </Link>
                            </div>
                        </CardBody>
                    </Card>
                )}
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.help')}</h3>
                    <Button
                        onPress={() => {
                            open('https://pot-app.com/docs/api/translate/ollama.html');
                        }}
                    >
                        {t('services.help')}
                    </Button>
                </div>
                <div className='config-item'>
                    <Switch
                        isSelected={serviceConfig['stream']}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                stream: value,
                            });
                        }}
                        classNames={{
                            base: 'flex flex-row-reverse justify-between w-full max-w-full',
                        }}
                    >
                        {t('services.translate.ollama.stream')}
                    </Switch>
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.ollama.request_path')}
                        labelPlacement='outside-left'
                        value={serviceConfig['requestPath']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                requestPath: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.ollama.model')}
                        labelPlacement='outside-left'
                        value={serviceConfig['model']}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                model: value,
                            });
                        }}
                        endContent={
                            installedModels &&
                            !installedModels.models
                                .map((model) => {
                                    return model.name;
                                })
                                .includes(serviceConfig['model']) ? (
                                <Tooltip content={t('services.translate.ollama.not_installed')}>
                                    <Button
                                        size='sm'
                                        variant='flat'
                                        color='warning'
                                        isLoading={isPulling}
                                        onPress={pullModel}
                                    >
                                        {t('services.translate.ollama.install_model')}
                                    </Button>
                                </Tooltip>
                            ) : (
                                <Button
                                    size='sm'
                                    variant='flat'
                                    color='success'
                                    disabled
                                >
                                    {t('services.translate.ollama.ready')}
                                </Button>
                            )
                        }
                    />
                </div>
                <h3 className='my-auto'>{t('services.translate.ollama.advanced_options')}</h3>
                <p className='text-[10px] text-default-700'>{t('services.translate.ollama.advanced_description')}</p>
                <div className='config-item'>
                    <h3 className='my-auto'>{t('services.translate.ollama.thinking_mode')}</h3>
                    <Dropdown>
                        <DropdownTrigger>
                            <Button variant='bordered'>
                                {t(`services.translate.ollama.thinking_${serviceConfig.thinkingMode}`)}
                            </Button>
                        </DropdownTrigger>
                        <DropdownMenu
                            autoFocus='first'
                            aria-label='thinking-mode'
                            onAction={(key) => {
                                setServiceConfig({
                                    ...serviceConfig,
                                    thinkingMode: key,
                                });
                            }}
                        >
                            <DropdownItem key={THINKING_MODE_DEFAULT}>
                                {t('services.translate.ollama.thinking_default')}
                            </DropdownItem>
                            <DropdownItem key={THINKING_MODE_OFF}>
                                {t('services.translate.ollama.thinking_off')}
                            </DropdownItem>
                            <DropdownItem key={THINKING_MODE_ON}>
                                {t('services.translate.ollama.thinking_on')}
                            </DropdownItem>
                        </DropdownMenu>
                    </Dropdown>
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.ollama.temperature')}
                        labelPlacement='outside-left'
                        type='number'
                        step='any'
                        value={serviceConfig['temperature']}
                        placeholder={t('services.translate.ollama.use_model_default')}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                temperature: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.ollama.top_p')}
                        labelPlacement='outside-left'
                        type='number'
                        step='any'
                        value={serviceConfig['topP']}
                        placeholder={t('services.translate.ollama.use_model_default')}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                topP: value,
                            });
                        }}
                    />
                </div>
                <div className='config-item'>
                    <Input
                        label={t('services.translate.ollama.top_k')}
                        labelPlacement='outside-left'
                        type='number'
                        step='1'
                        value={serviceConfig['topK']}
                        placeholder={t('services.translate.ollama.use_model_default')}
                        variant='bordered'
                        classNames={{
                            base: 'justify-between',
                            label: 'text-[length:--heroui-font-size-medium]',
                            mainWrapper: 'max-w-[50%]',
                        }}
                        onValueChange={(value) => {
                            setServiceConfig({
                                ...serviceConfig,
                                topK: value,
                            });
                        }}
                    />
                </div>
                <Card
                    isBlurred
                    className='border-none bg-success/20 dark:bg-success/10'
                    shadow='sm'
                >
                    <CardBody>
                        {isPulling && (
                            <Progress
                                size='sm'
                                radius='sm'
                                classNames={{
                                    base: 'max-w-md',
                                    track: 'drop-shadow-md border border-default',
                                    indicator: 'bg-gradient-to-r from-pink-500 to-yellow-500',
                                    label: 'tracking-wider font-medium text-default-600',
                                    value: 'text-foreground/60',
                                }}
                                label={pullingStatus}
                                value={progress}
                                showValueLabel={true}
                            />
                        )}
                        <div className='flex justify-center'>
                            <Link
                                isExternal
                                href='https://ollama.com/library'
                                color='primary'
                            >
                                {t('services.translate.ollama.supported_models')}
                            </Link>
                        </div>
                    </CardBody>
                </Card>
                <h3 className='my-auto'>Prompt List</h3>
                <p className='text-[10px] text-default-700'>{t('services.translate.ollama.prompt_description')}</p>

                <div className='bg-content2 rounded-[10px] p-3'>
                    {serviceConfig.promptList &&
                        serviceConfig.promptList.map((prompt, index) => {
                            return (
                                <div className='config-item'>
                                    <Textarea
                                        label={prompt.role}
                                        labelPlacement='outside'
                                        variant='faded'
                                        value={prompt.content}
                                        placeholder={`Input Some ${prompt.role} Prompt`}
                                        onValueChange={(value) => {
                                            setServiceConfig({
                                                ...serviceConfig,
                                                promptList: serviceConfig.promptList.map((p, i) => {
                                                    if (i === index) {
                                                        if (i === 0) {
                                                            return {
                                                                role: 'system',
                                                                content: value,
                                                            };
                                                        } else {
                                                            return {
                                                                role: index % 2 !== 0 ? 'user' : 'assistant',
                                                                content: value,
                                                            };
                                                        }
                                                    } else {
                                                        return p;
                                                    }
                                                }),
                                            });
                                        }}
                                    />
                                    <Button
                                        isIconOnly
                                        color='danger'
                                        className='my-auto mx-1'
                                        variant='flat'
                                        onPress={() => {
                                            setServiceConfig({
                                                ...serviceConfig,
                                                promptList: serviceConfig.promptList.filter((_, i) => i !== index),
                                            });
                                        }}
                                    >
                                        <MdDeleteOutline className='text-[18px]' />
                                    </Button>
                                </div>
                            );
                        })}
                    <Button
                        fullWidth
                        onPress={() => {
                            setServiceConfig({
                                ...serviceConfig,
                                promptList: [
                                    ...serviceConfig.promptList,
                                    {
                                        role:
                                            serviceConfig.promptList.length === 0
                                                ? 'system'
                                                : serviceConfig.promptList.length % 2 === 0
                                                  ? 'assistant'
                                                  : 'user',
                                        content: '',
                                    },
                                ],
                            });
                        }}
                    >
                        {t('services.translate.ollama.add')}
                    </Button>
                </div>
                <br />
                <Button
                    type='button'
                    onPress={() => {
                        setIsLoading(true);
                        translate('hello', Language.auto, Language.zh_cn, { config: serviceConfig }).then(
                            () => {
                                setIsLoading(false);
                                toast.success(t('config.service.test_success'), { style: toastStyle });
                            },
                            (e) => {
                                setIsLoading(false);
                                toast.error(t('config.service.test_failed') + e.toString(), { style: toastStyle });
                            }
                        );
                    }}
                    isLoading={isLoading}
                    fullWidth
                >
                    {t('common.test')}
                </Button>
                <Button
                    type='submit'
                    isLoading={isLoading}
                    fullWidth
                    color='primary'
                >
                    {t('common.save')}
                </Button>
            </form>
        )
    );
}
