export function convertFileSrc(path: string) {
    return path;
}

export async function invoke(command: string, args?: Record<string, unknown>) {
    console.info('[browser-smoke] invoke', command, args ?? {});

    switch (command) {
        case 'font_list':
            return ['Arial', 'Microsoft YaHei', 'Segoe UI'];
        case 'get_text':
        case 'get_ocr_text':
            return '';
        case 'plugin_list':
            return {};
        case 'read_history':
            return [];
        default:
            return null;
    }
}
