import fetch from 'node-fetch';
import fs from 'fs/promises';

const REPO = 'shirumesu/NeoPot';
const API_BASE = `https://api.github.com/repos/${REPO}`;

const platformAssets = {
    'windows-x86_64': (version) => `neopot_${version}_x64_fix_webview2_runtime-setup.exe`,
};

async function resolveUpdater() {
    const token = process.env.GITHUB_TOKEN;
    if (token === undefined) {
        throw new Error('GITHUB_TOKEN is required');
    }

    const release = await getRelease(token);
    const version = normalizeVersion(process.env.VERSION ?? release.tag_name);
    const changelog = release.body ?? '';

    const platforms = {};
    for (const [platform, assetNameFactory] of Object.entries(platformAssets)) {
        const assetName = assetNameFactory(version);
        platforms[platform] = await getPlatformUpdate(release, assetName);
    }

    const updateData = {
        version,
        notes: changelog,
        pub_date: release.published_at ?? new Date().toISOString(),
        platforms,
    };

    await fs.writeFile('./update-fix-runtime.json', `${JSON.stringify(updateData, null, 2)}\n`);
}

async function getRelease(token) {
    const tagName = process.env.RELEASE_TAG ?? process.env.GITHUB_REF_NAME;
    const releaseUrl = tagName
        ? `${API_BASE}/releases/tags/${encodeURIComponent(tagName)}`
        : `${API_BASE}/releases/latest`;

    const res = await fetch(releaseUrl, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to read release metadata: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

async function getPlatformUpdate(release, assetName) {
    const asset = findAsset(release, assetName);
    const signatureAsset = findAsset(release, `${assetName}.sig`);
    const signature = await readAssetText(signatureAsset.browser_download_url);

    return {
        signature,
        url: asset.browser_download_url,
    };
}

function findAsset(release, assetName) {
    const asset = release.assets?.find((item) => item.name === assetName);
    if (!asset) {
        throw new Error(`Missing release asset: ${assetName}`);
    }
    return asset;
}

async function readAssetText(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/octet-stream' },
    });

    if (!response.ok) {
        throw new Error(`Failed to read asset: ${url}`);
    }

    return response.text();
}

function normalizeVersion(version) {
    if (!version) {
        throw new Error('Release version is missing');
    }
    return version.replace(/^v/, '');
}

resolveUpdater().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
