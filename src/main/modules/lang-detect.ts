import { detect as tinyldDetect } from 'tinyld';

const languageMap: Record<string, string> = {
    zh: 'zh_cn',
    ja: 'ja',
    ko: 'ko',
    en: 'en',
    fr: 'fr',
    es: 'es',
    de: 'de',
    ru: 'ru',
    pt: 'pt_pt',
    tr: 'tr',
    ar: 'ar',
    vi: 'vi',
    th: 'th',
    id: 'id',
    ms: 'ms',
    hi: 'hi',
    mn: 'mn_cy',
    no: 'nb_no',
    nb: 'nb_no',
    nn: 'nn_no',
    fa: 'fa',
    uk: 'uk',
};

export async function detectLanguage(text: string): Promise<string> {
    const value = text.trim();
    if (!value) {
        return 'en';
    }

    if (/[\u4e00-\u9fff]/.test(value)) {
        return 'zh_cn';
    }
    if (/[\u3040-\u30ff]/.test(value)) {
        return 'ja';
    }
    if (/[\uac00-\ud7af]/.test(value)) {
        return 'ko';
    }

    const detected = tinyldDetect(value);
    return languageMap[detected] ?? 'en';
}
