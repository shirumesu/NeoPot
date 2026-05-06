#!/bin/bash

NODE_VERSION="24.0.0"
wget "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
tar -Jxvf "./node-v${NODE_VERSION}-linux-x64.tar.xz"
export PATH="$(pwd)/node-v${NODE_VERSION}-linux-x64/bin:$PATH"
npm install pnpm -g

rustup target add "$INPUT_TARGET"
rustup toolchain install --force-non-host "$INPUT_TOOLCHAIN"

if [ "$INPUT_TARGET" = "x86_64-unknown-linux-gnu" ]; then
    apt-get update
    apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf libxdo-dev libxcb1 libxrandr2 libdbus-1-3
else
    echo "Unknown target: $INPUT_TARGET" && exit 1
fi

bash .github/actions/build.sh
