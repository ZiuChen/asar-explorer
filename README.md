# ASAR Explorer

一个纯浏览器端的 Electron ASAR 文件预览和编辑器。无需后端服务，在浏览器中直接解析和编辑 ASAR 文件。

![ASAR Explorer Screenshot](./docs/screenshot.png)

## ✨ 特性

- 🌐 **纯浏览器运行** - 无需后端服务或 WebContainer
- 📦 **直接解析 ASAR** - 使用自研 asar-browser 库
- ✏️ **实时编辑** - Monaco Editor 提供专业的代码编辑体验
- 💾 **本地历史** - IndexedDB 存储编辑历史和快照
- 🎨 **代码高亮** - Shiki 预渲染 + Monaco 无缝切换
- 📁 **文件树浏览** - 直观的文件结构展示
- ⬇️ **导出修改** - 下载修改后的 ASAR 文件

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

## 📖 使用方法

1. **上传 ASAR 文件**
   - 点击上传区域选择文件
   - 或拖放 ASAR 文件到上传区域
   - 或输入 ASAR 文件的 URL

2. **浏览文件**
   - 在左侧文件树中浏览 ASAR 内容
   - 点击文件夹展开/折叠
   - 点击文件在编辑器中打开

3. **编辑文件**
   - 在 Monaco 编辑器中编辑文件内容
   - 修改会自动保存到本地

4. **导出修改**
   - 点击"下载修改后的 ASAR"导出
   - 或点击"下载原始 ASAR"获取原始文件

5. **历史记录**
   - 所有打开过的 ASAR 文件会自动保存
   - 可以随时从历史记录中重新加载

## 🏗️ 技术架构

详见 [架构文档](./docs/ARCHITECTURE.md)

### 核心技术

- **Vue 3.6** - 前端框架
- **modern-monaco** - Monaco 编辑器集成
- **Tailwind CSS 4** - 样式框架
- **shadcn-vue / reka-ui** - UI 组件库
- **IndexedDB** - 本地数据持久化

### 项目结构

```
src/
├── lib/
│   └── asar-browser/     # ASAR 解析库
├── models/
│   ├── types.ts          # 类型定义
│   ├── history-db.ts     # IndexedDB 存储
│   └── asar-filesystem.ts # 虚拟文件系统
├── stores/
│   └── asar.ts           # 状态管理
├── components/
│   ├── AsarUploader.vue  # 上传组件
│   ├── AsarSidebar.vue   # 侧边栏
│   └── AsarFileTree.vue  # 文件树
└── App.vue               # 主应用
```

## 📝 许可证

MIT License

