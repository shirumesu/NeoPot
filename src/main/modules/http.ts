import axios, { type AxiosRequestConfig } from 'axios';
import { applyProxyToAxios, applyProxyToFetch } from './proxy';

export interface ProviderRequest extends AxiosRequestConfig {
    timeoutMs?: number;
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
