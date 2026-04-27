import { useCallback } from 'react';

const AudioContextConstructor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
let audioContext = new AudioContextConstructor();
let source: AudioBufferSourceNode | null = null;

export const useVoice = () => {
    const playOrStop = useCallback((data: ArrayBuffer | ArrayLike<number>) => {
        if (source) {
            source.stop();
            source.disconnect();
            source = null;
        } else {
            const audioData = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
            audioContext.decodeAudioData(audioData, (buffer) => {
                const nextSource = audioContext.createBufferSource();
                nextSource.buffer = buffer;
                nextSource.connect(audioContext.destination);
                nextSource.start();
                nextSource.onended = () => {
                    nextSource.disconnect();
                    source = null;
                };
                source = nextSource;
            });
        }
    }, []);

    return playOrStop;
};
