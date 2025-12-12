[English](./README.md) | [中文](./README.zh-CN.md)

---

# ASAR Explorer

A pure browser-based Electron ASAR file preview and editor. No backend service required — parse and edit ASAR files directly in your browser.

[Vercel - Live Demo](https://asar-explorer.vercel.app/) · [Github - Live Demo](https://ziuchen.github.io/asar-explorer/)

## ✨ Features

- 🌐 **Pure Browser Execution** - No backend services or WebContainers needed
- 📦 **Direct ASAR Parsing** - Custom-built asar-browser library for handling ASAR files
- ✏️ **Real-time Editing** - Professional code editing with Monaco Editor
- 🎨 **Syntax Highlighting** - Shiki pre-rendering + seamless Monaco integration
- 📁 **Intuitive File Tree** - Clear hierarchical file structure visualization
- ⬇️ **Modified Export** - Download edited ASAR files
- 🔄 **Multi-language Support** - English, Chinese, and more
- 📱 **PWA Support** - Works offline with service workers
- ⚡ **Lazy Loading** - Web Workers for async ASAR processing

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
pnpm build
```

Output files are in the `dist/` directory.

## 📖 Usage Guide

### Loading ASAR Files

1. **Upload File** - Click the upload area or drag-and-drop your ASAR file
2. **From URL** - Paste a direct URL to an ASAR file
3. **From History** - Re-open previously loaded files from your history

### Browsing & Editing

1. **File Tree** - Navigate the ASAR contents in the left sidebar
2. **Open Files** - Click any file to open it in the editor
3. **Edit** - Make changes directly in Monaco Editor

### Exporting Changes

1. **Download Modified ASAR** - Export with all your edits applied
2. **Download Original** - Get the unmodified original file
3. **Create Snapshots** - Save named snapshots of your modifications

### Managing History

- All opened ASAR files are automatically saved
- Access them anytime from the History sidebar
- Delete items you no longer need

## 🏗️ Architecture

ASAR Explorer is built on a modular architecture:

- **asar-browser** - Custom ASAR parsing and packaging library
- **AsarFileSystem** - Virtual filesystem implementation for modern-monaco
- **Stores** - Vue 3 composables for state management

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Vue 3.6 |
| **Editor** | Monaco Editor (modern-monaco) |
| **Styling** | Tailwind CSS 4 |
| **UI Components** | shadcn-vue, Reka UI |
| **Formatting** | Prettier |
| **Code Highlight** | Shiki |
| **Notifications** | Vue Sonner |
| **Offline** | Workbox PWA |
| **Build Tool** | Vite + Rolldown |
| **Language Support** | Vue i18n |

## 🌍 Supported Languages

- English (en)
- Chinese Simplified (zh)

## 🎯 Limitations

- **Large Files** - Very large ASAR files may cause high memory usage
- **Binary Editing** - Binary files are view-only, text files can be edited
- **Unpacked Files** - ASAR `unpacked` directory feature not yet supported

## 🗺️ Roadmap

- [ ] File search functionality
- [ ] Create/delete file operations
- [ ] Diff view for modifications
- [ ] Multi-ASAR simultaneous editing
- [ ] Undo/redo support
- [ ] Directory bulk operations

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Report bugs via issues
2. Suggest features
3. Submit pull requests
4. Improve documentation

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- [electron/asar](https://github.com/electron/asar) - Original ASAR format spec
- [Banou26/asar-browser](https://github.com/Banou26/asar-browser) - Browser ASAR implementation reference
- [shadcn-vue](https://www.shadcn-vue.com/) - Component library
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Editor platform

