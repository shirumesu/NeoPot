<p align="center">
  <img width="160" src="public/icon.svg" alt="NeoPot icon" />
</p>

<h1 align="center">NeoPot</h1>

<p align="center">
  面向 Windows 和 Linux 的划词翻译、输入翻译、截图 OCR 与截图翻译工具。
</p>

<p align="center">
  <a href="README.en.md">English</a>
  |
  <span>简体中文</span>
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

> NeoPot 基于 Pot Desktop 继续维护，并迁移到 Electron、HeroUI 和 TypeScript。
> macOS 版本暂不发布。原因是 macOS 分发需要 Apple Developer 账号；当前安装说明只面向 Windows 与 Linux。

## 目录

- [功能预览](#功能预览)
- [主要功能](#主要功能)
- [支持接口](#支持接口)
- [安装](#安装)
- [插件系统](#插件系统)
- [外部调用](#外部调用)
- [Wayland 支持](#wayland-支持)
- [开发与构建](#开发与构建)
- [未来TODO](#未来TODO)
- [已知问题](#已知问题)
- [致谢](#致谢)

## 功能预览

| 划词翻译                                                    | 输入翻译                                                    | 外部调用                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| 选中文字后按下快捷键翻译                                    | 呼出翻译窗口后输入文本并回车                                | 通过本地 HTTP 接口被其他工具调用                            |
| <img src="docs/assets/readme/eg1.gif" alt="划词翻译演示" /> | <img src="docs/assets/readme/eg2.gif" alt="输入翻译演示" /> | <img src="docs/assets/readme/eg3.gif" alt="外部调用演示" /> |

| 剪贴板监听                                                    | 截图 OCR                                                     | 截图翻译                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| 开启监听后复制文本即可翻译                                    | 框选屏幕区域并识别文字                                       | 框选屏幕区域并翻译识别结果                                  |
| <img src="docs/assets/readme/eg4.gif" alt="剪贴板监听演示" /> | <img src="docs/assets/readme/eg5.gif" alt="截图 OCR 演示" /> | <img src="docs/assets/readme/eg6.gif" alt="截图翻译演示" /> |

<p align="center">
  <img src="docs/assets/readme/1.png" width="31%" alt="NeoPot screenshot 1" />
  <img src="docs/assets/readme/2.png" width="31%" alt="NeoPot screenshot 2" />
  <img src="docs/assets/readme/3.png" width="31%" alt="NeoPot screenshot 3" />
</p>

## 主要功能

- 多接口并行翻译
- 本地模型文字识别
- 插件语音合成
- 截图 OCR 与截图翻译
- 剪贴板监听翻译
- 本地 HTTP 外部调用
- 插件扩展系统
- Windows 与 Linux 支持
- Wayland 外部截图调用方案
- 多语言界面

## 支持接口

当前版本内置以下接口：

<details>
<summary>翻译</summary>

- Google
- DeepL
- Ollama

</details>

<details>
<summary>文字识别</summary>

- 本地模型 OCR（PaddleOCR.js PP-OCRv5）

</details>

<details>
<summary>语音合成</summary>

- 仅通过插件支持

</details>

**更多翻译引擎和服务**可通过插件系统扩展。打开应用内的插件市场获取社区插件。  
欢迎协助扩充官方[插件市场](https://github.com/shirumesu/Neopot-releases)

## 安装

请前往 [Releases](https://github.com/shirumesu/NeoPot/releases) 下载对应系统和架构的安装包。

### Windows

- `NeoPot-Setup-{version}.exe`: 64 位 Windows 安装包
- `NeoPot-{version}-portable-x64.exe`: 64 位 Windows 便携版

### Linux

发布页会提供 `deb`、`rpm` 和 `AppImage` 包。Debian/Ubuntu 可以直接安装下载到本地的 deb 文件：

```bash
sudo apt-get install ./NeoPot-*.deb
```

Arch、Manjaro、Flatpak、Homebrew、Winget 等分发入口尚未接入 NeoPot，请以 GitHub Releases 为准。

## 插件系统

NeoPot 支持通过插件扩展翻译、OCR 和语音合成功能。

**安装方式**：

- 从应用内插件市场直接安装
- 导入 `.zip` 插件包
- 选择本地插件目录（开发用）

插件可以添加新的翻译引擎、OCR 服务和 TTS 提供商。开发者可参考插件市场中的模板和文档创建自己的插件。

## 外部调用

NeoPot 提供本地 HTTP 接口，默认端口为 `60828`，可在设置中修改。

```text
POST "/"                                  翻译请求体中的文本
GET  "/config"                            打开设置
POST "/translate"                         翻译请求体中的文本
GET  "/selection_translate"               划词翻译
GET  "/input_translate"                   输入翻译
GET  "/ocr_recognize"                     截图 OCR
GET  "/ocr_translate"                     截图翻译
GET  "/ocr_recognize?screenshot=false"    使用外部截图文件进行 OCR
GET  "/ocr_translate?screenshot=false"    使用外部截图文件进行截图翻译
```

示例：

```bash
curl "127.0.0.1:60828/selection_translate"
```

### SnipDo

Windows 用户可以从 Microsoft Store 安装 SnipDo。SnipDo 扩展源码位于 `.scripts/snipdo/` 目录，可自行构建为 `.pbar` 文件后安装。

## Wayland 支持

Linux 全局快捷键在 Wayland 下可能受桌面环境限制。Wayland 用户可以通过桌面环境或窗口管理器绑定快捷键，再用 `curl` 调用 NeoPot 的本地 HTTP 接口。

Hyprland 外部截图示例：

```conf
bind = ALT, X, exec, grim -g "$(slurp)" ~/.cache/neopot/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_recognize?screenshot=false"
bind = ALT, C, exec, grim -g "$(slurp)" ~/.cache/neopot/pot_screenshot_cut.png && curl "127.0.0.1:60828/ocr_translate?screenshot=false"
```

浮动窗口示例：

```conf
windowrulev2 = float, class:(neopot), title:(Translator|OCR|Screenshot Translate)
windowrulev2 = move cursor 0 0, class:(neopot), title:(Translator|Screenshot Translate)
```

## 开发与构建

### 技术栈

- **桌面框架**: Electron 42+ with electron-vite
- **前端**: React 19, TypeScript, Vite 7
- **UI 框架**: HeroUI, Tailwind CSS 4
- **状态管理**: Jotai
- **国际化**: i18next

### 环境要求

已验证环境：

- Node.js `>= 24.0.0`
- pnpm `>= 9`

### 开始开发

拉取代码：

```bash
git clone https://github.com/shirumesu/NeoPot.git
cd NeoPot
pnpm install
```

Linux 打包工具（可选，仅用于构建 deb/rpm）：

```bash
sudo apt-get install -y rpm
```

常用命令：

```bash
pnpm run dev
pnpm run lint
pnpm run test
pnpm run format
pnpm run make
```

## 致谢

NeoPot 源自 [Pot Desktop](https://github.com/pot-app/pot-desktop)，并继续沿用 GPL-3.0-only 许可。感谢原项目及插件生态的长期积累。
