let text = '';

export async function writeText(value: string) {
    text = value;
}

export async function readText() {
    return text;
}
