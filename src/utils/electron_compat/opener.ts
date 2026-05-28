export async function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

export async function openPath(path: string) {
    window.open(path, '_blank', 'noopener,noreferrer');
}
