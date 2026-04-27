const getLabel = () => new URLSearchParams(window.location.search).get('window') ?? 'config';

const windowMock = {
    get label() {
        return getLabel();
    },
    async show() {},
    async hide() {},
    async close() {},
    async setFocus() {},
    async minimize() {},
    async maximize() {},
    async unmaximize() {},
    async isMaximized() {
        return false;
    },
    async setResizable() {},
    async setAlwaysOnTop() {},
    async setSize() {},
    async setPosition() {},
    async innerSize() {
        return { width: window.innerWidth, height: window.innerHeight };
    },
    async outerSize() {
        return { width: window.outerWidth, height: window.outerHeight };
    },
    async innerPosition() {
        return { x: window.screenX, y: window.screenY };
    },
    async outerPosition() {
        return { x: window.screenX, y: window.screenY };
    },
    async listen() {
        return () => {};
    },
    async emit() {},
};

export function getCurrentWebviewWindow() {
    return windowMock;
}

export class WebviewWindow {
    label: string;

    constructor(label: string) {
        this.label = label;
    }

    static async getByLabel(label: string) {
        return { ...windowMock, label };
    }
}
