// @ts-nocheck
import { Language } from './info';
import textDetectionModelUrl from './models/PP-OCRv5_mobile_det_onnx.tar?url';
import textRecognitionModelUrl from './models/PP-OCRv5_mobile_rec_onnx.tar?url';

const paddleLangMap = {
    [Language.auto]: 'ch',
    [Language.zh_cn]: 'ch',
    [Language.zh_tw]: 'chinese_cht',
    [Language.en]: 'en',
    [Language.ja]: 'japan',
};

const ocrCache = new Map();

async function getOcr(language) {
    const paddleLang = paddleLangMap[language];
    if (!paddleLang) {
        throw new Error('Language not supported by PaddleOCR.js local model.');
    }

    if (!ocrCache.has(paddleLang)) {
        const { PaddleOCR } = await import('@paddleocr/paddleocr-js');
        ocrCache.set(
            paddleLang,
            PaddleOCR.create({
                lang: paddleLang,
                ocrVersion: 'PP-OCRv5',
                textDetectionModelName: 'PP-OCRv5_mobile_det',
                textDetectionModelAsset: {
                    url: textDetectionModelUrl,
                },
                textRecognitionModelName: 'PP-OCRv5_mobile_rec',
                textRecognitionModelAsset: {
                    url: textRecognitionModelUrl,
                },
                ortOptions: {
                    backend: 'wasm',
                },
            })
        );
    }

    return ocrCache.get(paddleLang);
}

function base64ToBlob(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: 'image/png' });
}

export async function recognize(base64, language) {
    const ocr = await getOcr(language);
    const [result] = await ocr.predict(base64ToBlob(base64), {
        textRecScoreThresh: 0.3,
    });
    const text = (result?.items ?? []).map((item) => item.text).join('\n');
    if (language === Language.zh_cn || language === Language.zh_tw || language === Language.ja) {
        return text.replaceAll(' ', '').trim();
    }
    return text.trim();
}

export * from './Config';
export * from './info';
