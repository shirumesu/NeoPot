import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const BODY_KIND = Symbol('tauri-http-body-kind');

export const Body = {
    json(data) {
        return { [BODY_KIND]: 'json', data };
    },
    text(data) {
        return { [BODY_KIND]: 'text', data };
    },
    form(data) {
        return { [BODY_KIND]: 'form', data };
    },
};

function appendFormValue(form, key, value) {
    if (value && typeof value === 'object' && 'file' in value) {
        const blob = new Blob([value.file], {
            type: value.mime || 'application/octet-stream',
        });
        form.append(key, blob, value.fileName || key);
        return;
    }

    form.append(key, value);
}

function normalizeBody(init) {
    const headers = new Headers(init.headers || {});
    const body = init.body;

    if (!body || typeof body !== 'object' || !body[BODY_KIND]) {
        return { ...init, headers };
    }

    if (body[BODY_KIND] === 'json') {
        if (!headers.has('content-type')) {
            headers.set('content-type', 'application/json');
        }
        return { ...init, headers, body: JSON.stringify(body.data) };
    }

    if (body[BODY_KIND] === 'text') {
        return { ...init, headers, body: body.data };
    }

    const form = new FormData();
    Object.entries(body.data).forEach(([key, value]) => appendFormValue(form, key, value));
    return { ...init, headers, body: form };
}

async function readResponseData(response, responseType) {
    if (responseType === 3) {
        return response.arrayBuffer();
    }

    if (responseType === 2) {
        return response.text();
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

export async function fetch(input, init = {}) {
    const { responseType, query, skipData, ...requestInit } = init;
    const url = new URL(input);

    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.set(key, value);
            }
        });
    }

    const response = await tauriFetch(url.href, normalizeBody(requestInit));
    if (skipData) {
        return response;
    }

    const data = await readResponseData(response.clone(), responseType);

    Object.defineProperty(response, 'data', {
        value: data,
        enumerable: true,
    });

    return response;
}
