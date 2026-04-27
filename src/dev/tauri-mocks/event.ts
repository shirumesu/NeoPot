type UnlistenFn = () => void;

export async function listen<T>(
    event: string,
    handler: (payload: { event: string; payload: T }) => void
): Promise<UnlistenFn> {
    const listener = (browserEvent: Event) => {
        handler({
            event,
            payload: (browserEvent as CustomEvent<T>).detail,
        });
    };

    window.addEventListener(event, listener);
    return () => window.removeEventListener(event, listener);
}

export async function emit<T>(event: string, payload?: T) {
    window.dispatchEvent(new CustomEvent(event, { detail: payload }));
}
