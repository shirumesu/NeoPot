interface ElectronWebviewWindow {
    label: string;
    close(): Promise<void>;
    hide(): Promise<void>;
    show(): Promise<void>;
    setFocus(_focus?: boolean): Promise<void>;
    setAlwaysOnTop(_alwaysOnTop: boolean): Promise<void>;
    setResizable(_resizable: boolean): Promise<void>;
    setSize(_size: { width: number; height: number }): Promise<void>;
    setPosition(_position: { x: number; y: number }): Promise<void>;
    outerPosition(): Promise<{ x: number; y: number }>;
    outerSize(): Promise<{ width: number; height: number }>;
    isMaximized(): Promise<boolean>;
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    unmaximize(): Promise<void>;
    emit(_event: string, _payload?: unknown): Promise<void>;
}

export function getCurrentWebviewWindow(): ElectronWebviewWindow {
    const getLabel = () => {
        const label = new URLSearchParams(window.location.search).get('window');
        return label ?? 'config';
    };

    return {
        get label() {
            return getLabel();
        },
        close: () => window.neoPot?.app.closeCurrentWindow() ?? Promise.resolve(),
        hide: () => window.neoPot?.app.hideCurrentWindow() ?? Promise.resolve(),
        show: () => window.neoPot?.app.showCurrentWindow() ?? Promise.resolve(),
        setFocus: () => window.neoPot?.app.focusCurrentWindow() ?? Promise.resolve(),
        setAlwaysOnTop: (alwaysOnTop) =>
            window.neoPot?.app.setCurrentWindowAlwaysOnTop(alwaysOnTop) ?? Promise.resolve(),
        setResizable: (resizable) =>
            window.neoPot?.app.setCurrentWindowResizable(resizable) ?? Promise.resolve(),
        setSize: ({ width, height }) =>
            window.neoPot?.app.setCurrentWindowBounds({ width, height }) ?? Promise.resolve(),
        setPosition: ({ x, y }) =>
            window.neoPot?.app.setCurrentWindowBounds({ x, y }) ?? Promise.resolve(),
        outerPosition: async () => {
            const bounds = await window.neoPot?.app.getCurrentWindowBounds();
            return {
                x: bounds?.x ?? window.screenX,
                y: bounds?.y ?? window.screenY,
            };
        },
        outerSize: async () => {
            const bounds = await window.neoPot?.app.getCurrentWindowBounds();
            return {
                width: bounds?.width ?? window.outerWidth,
                height: bounds?.height ?? window.outerHeight,
            };
        },
        isMaximized: () => window.neoPot?.app.isCurrentWindowMaximized() ?? Promise.resolve(false),
        minimize: () => window.neoPot?.app.minimizeCurrentWindow() ?? Promise.resolve(),
        maximize: () => window.neoPot?.app.maximizeCurrentWindow() ?? Promise.resolve(),
        unmaximize: () => window.neoPot?.app.unmaximizeCurrentWindow() ?? Promise.resolve(),
        emit: (event, payload) => window.neoPot?.app.emit(event, payload) ?? Promise.resolve(),
    };
}
