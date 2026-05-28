export async function listen(event: string, handler: (event: { payload: unknown }) => void) {
    const windowEventName = `neopot:${event}`;
    const windowHandler = (windowEvent: Event) => {
        handler({ payload: (windowEvent as CustomEvent<unknown>).detail });
    };
    const unsubscribeElectron = window.neoPot?.app.onEvent(event, (payload) => {
        handler({ payload });
    });

    window.addEventListener(windowEventName, windowHandler);

    return () => {
        window.removeEventListener(windowEventName, windowHandler);
        unsubscribeElectron?.();
    };
}

export async function emit(event: string, payload?: unknown) {
    window.dispatchEvent(
        new CustomEvent(`neopot:${event}`, {
            detail: payload,
        })
    );
    await window.neoPot?.app.emit(event, payload);
}
