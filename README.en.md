<p align="center">
  <img width="160" src="public/icon.svg" alt="NeoPot icon" />
</p>

<h1 align="center">NeoPot</h1>

<p align="center">
  A text selection translation, input translation, screenshot OCR, and screenshot translation tool for Windows and Linux.
</p>

<p align="center">
  <span>English</span>
  |
  <a href="README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/shirumesu/NeoPot/releases/latest">下载最新版</a>
  |
  <a href="https://github.com/shirumesu/NeoPot/issues">反馈问题</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/github/v/release/shirumesu/NeoPot.svg" />
  <img alt="License" src="https://img.shields.io/github/license/shirumesu/NeoPot.svg" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-42-blue?logo=electron" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white" />
  <img alt="Windows" src="https://img.shields.io/badge/Windows-supported-blue?logo=windows&logoColor=white" />
  <img alt="Linux" src="https://img.shields.io/badge/Linux-supported-yellow?logo=linux&logoColor=white" />
</p>

> NeoPot is maintained as a continuation of Pot Desktop, with migrations to Electron, HeroUI, and TypeScript completed.
> A macOS version is not published for now. macOS distribution requires an Apple Developer account, and the current installation instructions are only targeted at Windows and Linux.

## Table of Contents

- [Feature Preview](#feature-preview)
- [Main Features](#main-features)
- [Supported Services](#supported-services)
- [Installation](#installation)
- [Plugin System](#plugin-system)
- [External Invocation](#external-invocation)
- [Wayland Support](#wayland-support)
- [Development and Build](#development-and-build)
- [Future TODO](#future-todo)
- [Known Issues](#known-issues)
- [Acknowledgements](#acknowledgements)

## Feature Preview

| Selection Translation                                                     | Input Translation                                                     | External Invocation                                                     |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Select text and press a shortcut to translate it                          | Open the translation window, enter text, and press Enter              | Invoke NeoPot from other tools through the local HTTP API               |
| <img src="docs/assets/readme/eg1.gif" alt="Selection translation demo" /> | <img src="docs/assets/readme/eg2.gif" alt="Input translation demo" /> | <img src="docs/assets/readme/eg3.gif" alt="External invocation demo" /> |

| Clipboard Monitoring                                                     | Screenshot OCR                                                     | Screenshot Translation                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Translate copied text after enabling clipboard monitoring                | Select a screen region and recognize text                          | Select a screen region and translate the recognized result                 |
| <img src="docs/assets/readme/eg4.gif" alt="Clipboard monitoring demo" /> | <img src="docs/assets/readme/eg5.gif" alt="Screenshot OCR demo" /> | <img src="docs/assets/readme/eg6.gif" alt="Screenshot translation demo" /> |

<p align="center">
  <img src="docs/assets/readme/1.png" width="31%" alt="NeoPot screenshot 1" />
  <img src="docs/assets/readme/2.png" width="31%" alt="NeoPot screenshot 2" />
  <img src="docs/assets/readme/3.png" width="31%" alt="NeoPot screenshot 3" />
</p>

## Main Features

- Parallel translation with multiple services
- Local-model text recognition
- Text-to-speech through plugins
- Screenshot OCR and screenshot translation
- Clipboard monitoring translation
- Local HTTP API for external invocation
- Plugin extension system
- Windows and Linux support
- External screenshot invocation support for Wayland
- Multilingual interface

## Supported Services

The current version ships these built-in services:

<details>
<summary>Translation</summary>

- Google
- DeepL
- Ollama

</details>

<details>
<summary>Text Recognition</summary>

- Local Model OCR (PaddleOCR.js PP-OCRv5)

</details>

<details>
<summary>Text-to-Speech</summary>

- Plugin support only

</details>

**More translation engines and services** can be added through the plugin system. Open the built-in plugin marketplace to browse community plugins.  
Welcome to contribute to the official [plugin marketplace](https://github.com/shirumesu/Neopot-releases).

## Installation

Go to [Releases](https://github.com/shirumesu/NeoPot/releases) and download the installer package for your system and architecture.

### Windows

- `NeoPot-Setup-{version}.exe`: 64-bit Windows installer
- `NeoPot-{version}-portable-x64.exe`: 64-bit Windows portable build

### Linux

The release page provides `deb`, `rpm`, and `AppImage` packages. On Debian/Ubuntu, you can install the downloaded deb file directly:

```bash
sudo apt-get install ./NeoPot-*.deb
```

Arch, Manjaro, Flatpak, Homebrew, Winget, and other distribution channels have not been connected to NeoPot yet. Use GitHub Releases as the source of truth.

## Plugin System

NeoPot supports extending translation, OCR, and text-to-speech functionality through plugins.

**Installation methods**:

- Install directly from the built-in plugin marketplace
- Import `.zip` plugin packages
- Select local plugin directories (for development)

Plugins can add new translation engines, OCR services, and TTS providers. Developers can refer to templates and documentation in the plugin marketplace to create their own plugins.

## External Invocation

NeoPot provides a local HTTP API. The default port is `60828`, and it can be changed in settings.

```text
POST "/"                                  Translate text in the request body
GET  "/config"                            Open settings
POST "/translate"                         Translate text in the request body
GET  "/selection_translate"               Selection translation
GET  "/input_translate"                   Input translation
GET  "/ocr_recognize"                     Screenshot OCR
GET  "/ocr_translate"                     Screenshot translation
GET  "/ocr_recognize?screenshot=false"    Use an external screenshot file for OCR
GET  "/ocr_translate?screenshot=false"    Use an external screenshot file for screenshot translation
```

Example:

```bash
curl "127.0.0.1:60828/selection_translate"
```

### SnipDo

Windows users can install SnipDo from the Microsoft Store. The SnipDo extension source code is located in the `.scripts/snipdo/` directory and can be built into a `.pbar` file for installation.

## Wayland Support

Linux global shortcuts may be limited by the desktop environment on Wayland. Wayland users can bind shortcuts through their desktop environment or window manager, then use `curl` to call NeoPot’s local HTTP API.

Hyprland external screenshot example:

```conf
bind = ALT, X, exec, grim -g "$(slurp)" ~/.cache/neopot/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
bind = ALT, C, exec, grim -g "$(slurp)" ~/.cache/neopot/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_translate?screenshot=false"
```

Floating window example:

```conf
windowrulev2 = float, class:(neopot), title:(Translator|OCR|Screenshot Translate)
windowrulev2 = move cursor 0 0, class:(neopot), title:(Translator|Screenshot Translate)
```

## Development and Build

### Technology Stack

- **Desktop framework**: Electron 42+ with electron-vite
- **Frontend**: React 19, TypeScript, Vite 7
- **UI framework**: HeroUI, Tailwind CSS 4
- **State management**: Jotai
- **Internationalization**: i18next

### Environment Requirements

Verified environment:

- Node.js `>= 24.0.0`
- pnpm `>= 9`

### Getting Started

Clone the repository:

```bash
git clone https://github.com/shirumesu/NeoPot.git
cd NeoPot
pnpm install
```

Linux packaging tools (optional, only for building deb/rpm):

```bash
sudo apt-get install -y rpm
```

Common commands:

```bash
pnpm run dev
pnpm run lint
pnpm run test
pnpm run format
pnpm run make
```

## Acknowledgements

NeoPot is derived from [Pot Desktop](https://github.com/pot-app/pot-desktop) and continues to use the GPL-3.0-only license. Thanks to the original project and its plugin ecosystem for their long-term contributions.
