#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

zip -j neopot.pbar neopot.json neopot.ps1 ../../public/icon.png
