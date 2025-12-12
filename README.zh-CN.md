[English](./README.md) | [中文](./README.zh-CN.md)

---

# ASAR Explorer

一个纯浏览器端的 Electron ASAR 文件预览和编辑器。无需后端服务，在浏览器中直接解析和编辑 ASAR 文件。

[Vercel - 在线体验](https://asar-explorer.vercel.app/) · [Github - 在线体验](https://ziuchen.github.io/asar-explorer/)

## ✨ 特性

- 🌐 **纯浏览器运行** - 无需后端服务或 WebContainer
- 📦 **直接解析 ASAR** - 自研 asar-browser 库，完全浏览器实现
- ✏️ **实时编辑** - Monaco Editor 提供专业的代码编辑体验
- 🎨 **代码高亮** - Shiki 预渲染 + Monaco 无缝切换
- 📁 **文件树浏览** - 直观的文件结构展示和导航
- ⬇️ **导出修改** - 下载修改后的 ASAR 文件
- 🔄 **多语言支持** - 英文、中文等多语言
- 📱 **PWA 离线** - 支持服务工作线程离线工作
- ⚡ **懒加载优化** - Web Worker 异步处理大型 ASAR 文件

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm (或 npm/yarn)

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

应用将在 `http://localhost:5173` 运行

### 生产构建

```bash
pnpm build
```

输出文件位于 `dist/` 目录

## 📖 使用指南

### 加载 ASAR 文件

1. **上传文件** - 点击上传区域或拖放 ASAR 文件
2. **从 URL 加载** - 输入 ASAR 文件的直接 URL
3. **从历史记录** - 重新打开之前加载过的文件

### 浏览和编辑

1. **文件树** - 在左侧侧边栏中浏览 ASAR 内容
2. **打开文件** - 点击任何文件在编辑器中打开
3. **编辑** - 直接在 Monaco 编辑器中进行修改

### 导出修改

1. **下载修改后的 ASAR** - 导出包含所有编辑的文件
2. **下载原始 ASAR** - 获取未修改的原始文件
3. **创建快照** - 保存修改的命名快照

### 管理历史

- 所有打开过的 ASAR 文件都会自动保存
- 可随时从历史记录侧边栏访问
- 删除不再需要的项目

## 🏗️ 架构设计

ASAR Explorer 基于模块化架构设计：

- **asar-browser** - 自研 ASAR 解析和打包库
- **AsarFileSystem** - modern-monaco 虚拟文件系统实现
- **Stores** - Vue 3 组合式 API 状态管理

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **框架** | Vue 3.6 |
| **编辑器** | Monaco Editor (modern-monaco) |
| **样式** | Tailwind CSS 4 |
| **UI 组件** | shadcn-vue, Reka UI |
| **代码格式** | Prettier |
| **代码高亮** | Shiki |
| **通知** | Vue Sonner |
| **离线支持** | Workbox PWA |
| **构建工具** | Vite + Rolldown |
| **多语言** | Vue i18n |

## 🌍 支持的语言

- English (en)
- 简体中文 (zh)

## 🎯 限制条件

- **大文件处理** - 非常大的 ASAR 文件可能导致浏览器内存不足
- **二进制编辑** - 二进制文件仅可查看，文本文件支持编辑
- **Unpacked 文件** - 暂不支持 ASAR 的 unpacked 目录功能

## 🗺️ 发展路线

- [ ] 文件搜索功能
- [ ] 创建/删除文件操作
- [ ] Diff 对比视图
- [ ] 同时打开多个 ASAR 文件
- [ ] 撤销/重做功能
- [ ] 目录批量操作

## 🤝 贡献指南

欢迎贡献！您可以：

1. 通过 Issues 报告 bug
2. 提出新功能建议
3. 提交 Pull Request
4. 改进文档

## 📄 开源协议

MIT License - 详见 LICENSE 文件

## 🙏 致谢

- [electron/asar](https://github.com/electron/asar) - ASAR 格式规范
- [Banou26/asar-browser](https://github.com/Banou26/asar-browser) - 浏览器 ASAR 实现参考
- [shadcn-vue](https://www.shadcn-vue.com/) - UI 组件库
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - 编辑器平台
