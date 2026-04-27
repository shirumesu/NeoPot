let enabled = false;

export async function isEnabled() {
    return enabled;
}

export async function enable() {
    enabled = true;
}

export async function disable() {
    enabled = false;
}
