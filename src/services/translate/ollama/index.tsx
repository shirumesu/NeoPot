// @ts-nocheck
import { Ollama } from 'ollama/browser';

import { fetch } from '@/utils/tauri_http';
import { Language } from './info';

const THINKING_MODE_DEFAULT = 'default';
const THINKING_MODE_ON = 'on';
const THINKING_MODE_OFF = 'off';
const DEFAULT_MODEL = 'gemma4:e2b';
const LEGACY_DEFAULT_MODEL = 'gemma:2b';

function normalizeHost(requestPath) {
    let normalized = requestPath?.trim() || 'http://localhost:11434';

    if (!/^https?:\/\/.+/i.test(normalized)) {
        normalized = `http://${normalized}`;
    }

    return normalized.replace(/\/+$/, '');
}

function parseOptionalFloat(value, fieldName) {
    if (value === undefined || value === null || String(value).trim() === '') {
        return undefined;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw `Invalid ${fieldName}: ${value}`;
    }

    return parsed;
}

function parseOptionalInteger(value, fieldName) {
    const parsed = parseOptionalFloat(value, fieldName);
    if (parsed === undefined) {
        return undefined;
    }

    if (!Number.isInteger(parsed)) {
        throw `Invalid ${fieldName}: ${value}`;
    }

    return parsed;
}

function buildOptions(config) {
    const options = {};
    const temperature = parseOptionalFloat(config.temperature, 'temperature');
    const topP = parseOptionalFloat(config.topP, 'top_p');
    const topK = parseOptionalInteger(config.topK, 'top_k');

    if (temperature !== undefined) {
        options.temperature = temperature;
    }
    if (topP !== undefined) {
        options.top_p = topP;
    }
    if (topK !== undefined) {
        options.top_k = topK;
    }

    return Object.keys(options).length > 0 ? options : undefined;
}

function applyThinkingMode(promptList, model, thinkingMode) {
    const normalizedPromptList = promptList.map((item) => ({ ...item }));

    if (!model?.toLowerCase().startsWith('gemma4')) {
        return normalizedPromptList;
    }

    const systemIndex = normalizedPromptList.findIndex((item) => item.role === 'system');
    if (systemIndex === -1) {
        return normalizedPromptList;
    }

    const systemMessage = normalizedPromptList[systemIndex];
    const strippedContent = (systemMessage.content || '').replace(/^<\|think\|>\s*/u, '');

    if (thinkingMode === THINKING_MODE_ON) {
        normalizedPromptList[systemIndex] = {
            ...systemMessage,
            content: strippedContent ? `<|think|>\n${strippedContent}` : '<|think|>',
        };
    } else if (thinkingMode === THINKING_MODE_OFF) {
        normalizedPromptList[systemIndex] = {
            ...systemMessage,
            content: strippedContent,
        };
    }

    return normalizedPromptList;
}

function isGemma4Model(model) {
    return model?.toLowerCase().startsWith('gemma4');
}

function resolveThinkValue(thinkingMode) {
    if (thinkingMode === THINKING_MODE_ON) {
        return true;
    }
    if (thinkingMode === THINKING_MODE_OFF) {
        return false;
    }

    return undefined;
}

function resolveModel(model) {
    if (!model || model === LEGACY_DEFAULT_MODEL) {
        return DEFAULT_MODEL;
    }

    return model;
}

function createClient(requestPath) {
    return new Ollama({
        host: normalizeHost(requestPath),
        fetch,
    });
}

export async function getModels(requestPath) {
    return createClient(requestPath).list();
}

export async function pullModel(requestPath, model) {
    return createClient(requestPath).pull({ model, stream: false });
}

async function readStreamResponse(response, setResult) {
    let target = '';

    for await (const part of response) {
        const content = part.message?.content || '';
        if (!content) {
            continue;
        }

        target += content;
        if (setResult) {
            setResult(`${target}_`);
        } else {
            response.abort();
            return '[STREAM]';
        }
    }

    if (setResult) {
        setResult(target.trim());
    }

    return target.trim();
}

export async function translate(text, from, to, options = {}) {
    const { config, setResult, detect } = options;

    let { stream, promptList, requestPath, model, thinkingMode } = config;
    model = resolveModel(model);

    promptList = promptList.map((item) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', text)
                .replaceAll('$from', from)
                .replaceAll('$to', to)
                .replaceAll('$detect', Language[detect]),
        };
    });

    promptList = applyThinkingMode(promptList, model, thinkingMode);

    const requestBody = {
        model,
        messages: promptList,
        stream: !!stream,
    };
    const modelOptions = buildOptions(config);
    const think = isGemma4Model(model) ? undefined : resolveThinkValue(thinkingMode);

    requestBody.options = modelOptions;
    requestBody.think = think;

    const client = createClient(requestPath);

    if (stream) {
        const response = await client.chat(requestBody);
        return readStreamResponse(response, setResult);
    }

    const result = await client.chat(requestBody);
    const target = result.message?.content?.trim();

    if (target) {
        if (setResult) {
            setResult(target);
        }
        return target;
    }

    throw JSON.stringify(result);
}

export * from './Config';
export * from './info';

