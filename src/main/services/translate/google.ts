import { createProviderClient } from '../../modules/http';

export interface GoogleTranslateRequest {
    text: string;
    from: string;
    to: string;
    config?: {
        custom_url?: string;
    };
}

export async function translateGoogle(request: GoogleTranslateRequest): Promise<string> {
    const customUrl = request.config?.custom_url?.trim() || 'https://translate.google.com';
    const baseURL = customUrl.startsWith('http') ? customUrl : `https://${customUrl}`;
    const client = createProviderClient(baseURL);

    const result = await client.request<unknown[]>({
        url: '/translate_a/single',
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        params: {
            client: 'gtx',
            sl: request.from,
            tl: request.to,
            hl: request.to,
            ie: 'UTF-8',
            oe: 'UTF-8',
            dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
            q: request.text,
        },
    });

    const segments = Array.isArray(result[0]) ? result[0] : [];
    return segments
        .map((segment) => (Array.isArray(segment) ? segment[0] : ''))
        .filter((segment): segment is string => typeof segment === 'string')
        .join('')
        .trim();
}
