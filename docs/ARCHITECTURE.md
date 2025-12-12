# ASAR Explorer 架构文档

## 概述

ASAR Explorer 是一个纯浏览器端的 Electron ASAR 文件预览和编辑器。它不依赖任何后端服务或 WebContainer，而是在浏览器中直接解析和处理 ASAR 文件。

## 技术栈

- **Vue 3.6** - 前端框架
- **modern-monaco** - Monaco 编辑器集成，支持 Workspace 和懒加载
- **Tailwind CSS 4** - 样式框架
- **shadcn-vue / reka-ui** - UI 组件库
- **IndexedDB** - 本地数据持久化

## 核心模块

### 1. asar-browser 库

位置：`/src/lib/asar-browser/`

这是一个纯浏览器实现的 ASAR 文件解析和打包库，参考了 [Banou26/asar-browser](https://github.com/Banou26/asar-browser)。

#### 模块结构

```
lib/asar-browser/
├── types.ts      # 类型定义
├── utils.ts      # 工具函数
├── pickle.ts     # 二进制打包工具（替代 Node.js Buffer）
├── extractor.ts  # ASAR 解包功能
├── packager.ts   # ASAR 打包功能
└── index.ts      # 统一导出
```

#### 主要功能

- **`getHeader(data, options?)`** - 解析 ASAR 头部信息
- **`extractFile(data, path)`** - 提取单个文件
- **`listPackage(data)`** - 列出所有文件
- **`extractAll(data)`** - 提取所有文件
- **`createPackage(files)`** - 创建新的 ASAR
- **`modifyPackage(data, modifications)`** - 修改现有 ASAR

#### Pickle 实现

由于浏览器没有 Node.js 的 `Buffer`，我们实现了自己的 `Pickle` 类来处理二进制数据：

```typescript
class Pickle {
  private buffer: Uint8Array
  private view: DataView
  
  writeString(value: string): void
  writeUInt32(value: number): void
  toBuffer(): Uint8Array
}
```

### 2. 数据模型

位置：`/src/models/`

#### 类型定义 (`types.ts`)

```typescript
// ASAR 元信息
interface AsarMeta {
  id: string
  name: string
  size: number
  importedAt: number
  lastModifiedAt: number
  source: 'file' | 'url' | 'data-url'
  sourceUrl?: string
  hash: string
}

// 编辑快照
interface AsarSnapshot {
  id: string
  asarId: string
  name: string
  createdAt: number
  modifiedFiles: string[]
  description?: string
}

// 文件修改记录
interface FileModification {
  id: string
  asarId: string
  path: string
  content: Uint8Array
  modifiedAt: number
}

// 文件树节点
interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  size?: number
  modified?: boolean
}
```

#### IndexedDB 存储层 (`history-db.ts`)

`AsarHistoryDB` 类封装了所有 IndexedDB 操作：

```typescript
class AsarHistoryDB {
  // ASAR 管理
  saveAsar(meta: AsarMeta, data: ArrayBuffer): Promise<void>
  getAsarMeta(id: string): Promise<AsarMeta | undefined>
  getAsarData(id: string): Promise<ArrayBuffer | undefined>
  findAsarByHash(hash: string): Promise<AsarMeta | undefined>
  getAllAsarHistory(): Promise<AsarHistoryItem[]>
  deleteAsar(id: string): Promise<void>
  
  // 修改管理
  saveModification(mod: FileModification): Promise<void>
  getModifications(asarId: string, path: string): Promise<FileModification[]>
  getAllModifications(asarId: string): Promise<FileModification[]>
  clearModifications(asarId: string): Promise<void>
  
  // 快照管理
  createSnapshot(snapshot: AsarSnapshot): Promise<void>
  getSnapshots(asarId: string): Promise<AsarSnapshot[]>
  deleteSnapshot(id: string): Promise<void>
}
```

**数据库结构**：

| Object Store | 主键 | 索引 |
|-------------|------|------|
| `asar-meta` | `id` | `hash` |
| `asar-data` | `id` | - |
| `modifications` | `id` | `[asarId, path]`, `asarId` |
| `snapshots` | `id` | `asarId` |

### 3. 虚拟文件系统

位置：`/src/models/asar-filesystem.ts`

`AsarFileSystem` 实现了 modern-monaco 的 `FileSystem` 接口，将 ASAR 内容映射为虚拟文件系统：

```typescript
class AsarFileSystem implements FileSystem {
  // 加载 ASAR
  loadFromAsar(data: ArrayBuffer, asarId: string): Promise<void>
  clear(): void
  
  // FileSystem 接口
  readFile(filename: string): Promise<Uint8Array>
  writeFile(filename: string, content: Uint8Array, context?): Promise<void>
  readDirectory(filename: string): Promise<[string, number][]>
  stat(filename: string): Promise<FileStat>
  createDirectory(dir: string): Promise<void>
  delete(filename: string, options?): Promise<void>
  copy(source: string, target: string, options?): Promise<void>
  rename(oldName: string, newName: string, options?): Promise<void>
  watch(filename: string, options, handle): () => void
  
  // 辅助方法
  getFileTree(): FileTreeNode[]
  getModifiedFiles(): string[]
  resetFile(path: string): Promise<void>
}
```

**特性**：

- **懒加载**：文件内容只在首次读取时从 ASAR 提取
- **自动持久化**：写入操作自动保存到 IndexedDB
- **文件监听**：支持文件变更通知

### 4. 状态管理

位置：`/src/stores/asar.ts`

使用 Vue 的组合式 API 管理应用状态：

```typescript
// 状态
const currentAsar = ref<AsarMeta | null>(null)
const fileTree = shallowRef<FileTreeNode[]>([])
const currentFile = ref<string | null>(null)
const modifiedFiles = ref<Set<string>>(new Set())
const asarHistory = shallowRef<AsarHistoryItem[]>([])
const snapshots = shallowRef<AsarSnapshot[]>([])

// 操作
function loadFromFile(file: File): Promise<void>
function loadFromUrl(url: string): Promise<void>
function loadFromHistory(id: string): Promise<void>
function openFile(path: string): Promise<void>
function createSnapshot(name: string, description?): Promise<void>
function downloadModifiedAsar(): Promise<void>
function downloadOriginalAsar(): Promise<void>
function closeAsar(): void
```

## 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户界面                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ AsarUploader │  │ AsarSidebar  │  │   Monaco Editor      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼─────────────────────┼───────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Store (asar.ts)                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  currentAsar, fileTree, currentFile, modifiedFiles, ...   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│ AsarHistoryDB│ │AsarFileFS│ │ Workspace    │
│  (IndexedDB) │ │          │ │(modern-monaco)│
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      ▼
        ┌─────────────────────────┐
        │    asar-browser 库      │
        │  (解析/打包 ASAR 文件)   │
        └─────────────────────────┘
```

## 编辑器集成

### modern-monaco Workspace

使用 `Workspace` 管理多文件编辑环境：

```typescript
const workspace = new Workspace({
  name: 'asar-explorer',
  customFS: asarFS,  // 使用自定义文件系统
})

await lazy({ workspace })  // 启用懒加载模式
```

### 懒加载与 Shiki

modern-monaco 的 `lazy()` 模式会先使用 Shiki 进行语法高亮，等 Monaco 完全加载后再水合为完整编辑器。这提供了更好的初始加载体验。

## UI 组件

```
src/components/
├── AsarUploader.vue   # ASAR 文件上传组件
├── AsarSidebar.vue    # 侧边栏（文件树 + 操作按钮）
├── AsarFileTree.vue   # 文件树组件
└── ui/                # shadcn-vue 组件
    ├── sidebar/       # 侧边栏 UI
    ├── button/        # 按钮
    ├── input/         # 输入框
    └── ...
```

## 工作流程

### 1. 加载 ASAR 文件

```
用户上传/输入 URL
       │
       ▼
获取 ArrayBuffer
       │
       ▼
计算文件哈希
       │
       ▼
检查 IndexedDB 是否存在
       │
       ├─── 存在 ──→ 更新时间戳
       │
       └─── 不存在 ──→ 创建新记录
              │
              ▼
     保存到 IndexedDB
              │
              ▼
  加载到 AsarFileSystem
              │
              ▼
     解析头部，构建文件树
              │
              ▼
   加载已有修改（从 IndexedDB）
              │
              ▼
     更新 UI 状态
```

### 2. 编辑文件

```
用户在 Monaco 中编辑
       │
       ▼
Monaco 调用 FileSystem.writeFile()
       │
       ▼
更新内存中的文件节点
       │
       ▼
保存修改到 IndexedDB
       │
       ▼
通知文件监听器
       │
       ▼
更新修改文件列表
```

### 3. 导出修改后的 ASAR

```
用户点击"下载修改后的 ASAR"
       │
       ▼
获取原始 ASAR 数据
       │
       ▼
获取所有修改记录
       │
       ▼
调用 modifyPackage()
       │
       ▼
生成新的 ASAR ArrayBuffer
       │
       ▼
创建 Blob 并下载
```

## 扩展点

### 添加新的文件类型支持

在 `asar-filesystem.ts` 中扩展 `stat()` 方法来识别更多文件类型。

### 自定义编辑器配置

通过 Workspace 的配置选项自定义 Monaco 行为。

### 添加文件操作

在 `AsarFileSystem` 中实现更多文件操作方法。

## 限制

1. **大文件性能**：非常大的 ASAR 文件可能导致浏览器内存不足
2. **二进制文件**：编辑器主要针对文本文件，二进制文件只能查看
3. **unpacked 文件**：当前不支持 ASAR 的 unpacked 文件功能

## 未来计划

- [ ] 添加文件搜索功能
- [ ] 支持创建/删除文件
- [ ] 添加 diff 视图
- [ ] 支持多个 ASAR 文件同时打开
- [ ] 添加撤销/重做功能
