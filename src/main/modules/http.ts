import axios, { type AxiosRequestConfig } from 'axios';
import { applyProxyToAxios, applyProxyToFetch } from './proxy';

export interface ProviderRequest extends AxiosRequestConfig {
    timeoutMs?: number;
}

type RendererBody =
    | { kind: 'json'; data: unknown }
    | { kind: 'text'; data: string }
    | { kind: 'form'; data: Record<string, unknown> };

interface RendererHttpRequest {
    url?: unknown;
    method?: unknown;
    headers?: unknown;
    query?: unknown;
    body?: unknown;
    responseType?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRendererHeaders(headers: unknown): Record<string, string> {
    if (!isRecord(headers)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(headers)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
            .map(([key, value]) => [key.toLowerCase(), value])
    );
}

function normalizeRendererBody(body: unknown, headers: Record<string, string>): unknown {
    if (!isRecord(body) || typeof body.kind !== 'string') {
        return body;
    }

    const rendererBody = body as RendererBody;
    if (rendererBody.kind === 'json') {
        headers['content-type'] ??= 'application/json';
        return rendererBody.data;
    }

    if (rendererBody.kind === 'text') {
        return rendererBody.data;
    }

    if (headers['content-type']?.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams();
        Object.entries(rendererBody.data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                params.set(key, String(value));
            }
        });
        return params.toString();
    }

    const params = new FormData();
    Object.entries(rendererBody.data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.set(key, String(value));
        }
    });
    return params;
}

export async function request<T = unknown>(options: ProviderRequest): Promise<T> {
    const response = await axios.request<T>(
        applyProxyToAxios({
            timeout: options.timeoutMs ?? options.timeout ?? 30000,
            ...options,
        })
    );

    return response.data;
}

export async function rendererHttpRequest(input: unknown): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: unknown;
}> {
    if (!isRecord(input) || typeof input.url !== 'string') {
        throw new Error('Expected renderer HTTP request URL.');
    }

    const requestInput = input as RendererHttpRequest;
    const headers = normalizeRendererHeaders(requestInput.headers);
    const responseType =
        requestInput.responseType === 3 ? 'arraybuffer' : requestInput.responseType === 2 ? 'text' : 'json';

    const response = await axios.request(
        applyProxyToAxios({
            url: input.url,
            method: typeof requestInput.method === 'string' ? requestInput.method : 'GET',
            headers,
            params: isRecord(requestInput.query) ? requestInput.query : undefined,
            data: normalizeRendererBody(requestInput.body, headers),
            responseType,
            timeout: 30000,
            validateStatus: () => true,
        })
    );

    const data =
        requestInput.responseType === 3 && response.data instanceof Uint8Array
            ? Array.from(response.data)
            : requestInput.responseType === 3 && response.data instanceof ArrayBuffer
              ? Array.from(new Uint8Array(response.data))
              : response.data;

    return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(
            Object.entries(response.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value)])
        ),
        data,
    };
}

export async function streamRequest(input: RequestInfo | URL, init: RequestInit = {}): Promise<ReadableStream<Uint8Array> | null> {
    const response = await fetch(input, applyProxyToFetch(init));
    if (!response.ok) {
        throw new Error(`SERVICE_HTTP_ERROR:${response.status}`);
    }

    return response.body;
}

export function createProviderClient(baseURL?: string) {
    return {
        request: <T = unknown>(options: ProviderRequest) =>
            request<T>({
                baseURL,
                ...options,
            }),
        streamRequest,
    };
}
