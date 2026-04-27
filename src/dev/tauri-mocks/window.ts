export async function currentMonitor() {
    return {
        position: { x: 0, y: 0 },
        size: { width: window.screen.width || 1280, height: window.screen.height || 720 },
        scaleFactor: 1,
    };
}

export class LogicalSize {
    width: number;
    height: number;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
}

export class LogicalPosition {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }
}
