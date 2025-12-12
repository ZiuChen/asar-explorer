/**
 * ASAR FileSystem
 * 虚拟文件系统，将 ASAR 内容映射为内存文件系统
 */

import { parseHeaderAsync, extractFileAsync } from '@/lib/asar-browser'

/** 文件系统条目类型 */
const FileType = {
  Unknown: 0,
  File: 1,
  Directory: 2,
  SymbolicLink: 64
} as const

type FileSystemEntryType = 0 | 1 | 2 | 64

interface FileStat {
  readonly type: FileSystemEntryType
  readonly ctime: number
  readonly mtime: number
  readonly version: number
  readonly size: number
}

interface FileSystemWatchContext {
  isModelContentChange?: boolean
}

interface FileSystemWatchHandle {
  (
    kind: 'create' | 'modify' | 'remove',
    filename: string,
    type?: number,
    context?: FileSystemWatchContext
  ): void
}

/** 内存中的文件节点 */
interface FileNode {
  type: 1 | 2 // 1=file, 2=directory
  content?: Uint8Array
  children?: Map<string, FileNode>
  size: number
  ctime: number
  mtime: number
  version: number
  /** 是否从原始 ASAR 加载 */
  fromAsar: boolean
  /** 原始 ASAR 中的偏移（用于懒加载） */
  asarOffset?: number
}

/** 文件监听器 */
interface FileWatcher {
  path: string
  recursive: boolean
  handle: FileSystemWatchHandle
}

/**
 * ASAR 文件系统
 * 将 ASAR 内容映射为虚拟文件系统
 */
export class AsarFileSystem {
  private root: FileNode
  private watchers: FileWatcher[] = []
  private asarData: ArrayBuffer | null = null
  private asarId: string | null = null

  constructor() {
    this.root = this.createDirectoryNode()
  }

  /** 创建目录节点 */
  private createDirectoryNode(): FileNode {
    const now = Date.now()
    return {
      type: FileType.Directory as 2,
      children: new Map(),
      size: 0,
      ctime: now,
      mtime: now,
      version: 1,
      fromAsar: false
    }
  }

  /** 创建文件节点 */
  private createFileNode(content: Uint8Array, fromAsar = false): FileNode {
    const now = Date.now()
    return {
      type: FileType.File as 1,
      content,
      size: content.length,
      ctime: now,
      mtime: now,
      version: 1,
      fromAsar
    }
  }

  /** 规范化路径 */
  private normalizePath(path: string): string {
    // 移除 file:// 协议前缀
    let normalizedPath = path.replace(/^file:\/\//, '')
    // 移除开头的 / 并规范化
    return normalizedPath.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/+/g, '/')
  }

  /** 获取路径的各个部分 */
  private getPathParts(path: string): string[] {
    const normalized = this.normalizePath(path)
    return normalized ? normalized.split('/') : []
  }

  /** 获取父目录路径 */
  private getParentPath(path: string): string {
    const parts = this.getPathParts(path)
    parts.pop()
    return parts.join('/')
  }

  /** 获取文件名 */
  private getFileName(path: string): string {
    const parts = this.getPathParts(path)
    return parts[parts.length - 1] || ''
  }

  /** 获取节点 */
  private getNode(path: string): FileNode | null {
    const parts = this.getPathParts(path)
    let node = this.root

    for (const part of parts) {
      if (node.type !== FileType.Directory || !node.children) {
        return null
      }
      const child = node.children.get(part)
      if (!child) {
        return null
      }
      node = child
    }

    return node
  }

  /** 获取或创建父目录 */
  private getOrCreateParent(path: string): FileNode {
    const parentPath = this.getParentPath(path)
    const parts = this.getPathParts(parentPath)
    let node = this.root

    for (const part of parts) {
      if (!node.children) {
        node.children = new Map()
      }
      let child = node.children.get(part)
      if (!child) {
        child = this.createDirectoryNode()
        node.children.set(part, child)
      }
      node = child
    }

    return node
  }

  /** 通知文件变化 */
  private notifyWatchers(
    kind: 'create' | 'modify' | 'remove',
    filename: string,
    type: number = FileType.File,
    context?: FileSystemWatchContext
  ): void {
    const normalizedPath = this.normalizePath(filename)

    for (const watcher of this.watchers) {
      const watchPath = this.normalizePath(watcher.path)

      // 检查是否匹配
      if (watcher.recursive) {
        if (
          normalizedPath.startsWith(watchPath) ||
          watchPath === '' ||
          normalizedPath === watchPath
        ) {
          watcher.handle(kind, filename, type, context)
        }
      } else {
        const parentPath = this.getParentPath(normalizedPath)
        if (parentPath === watchPath || (watchPath === '' && !normalizedPath.includes('/'))) {
          watcher.handle(kind, filename, type, context)
        }
      }
    }
  }

  // ========== 加载 ASAR ==========

  /** 从 ASAR 数据初始化文件系统（使用 WebWorker 解析头部） */
  async loadFromAsar(data: ArrayBuffer, asarId: string): Promise<void> {
    this.asarData = data
    this.asarId = asarId
    this.root = this.createDirectoryNode()

    // 在 WebWorker 中解析 ASAR 头部
    const { files } = await parseHeaderAsync(data)

    // 构建文件树
    for (const file of files) {
      const path = file.path.replace(/^\//, '')
      const parts = path.split('/').filter(Boolean)

      // 确保父目录存在
      let node = this.root
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i]!
        if (!node.children) {
          node.children = new Map()
        }
        let child = node.children.get(part)
        if (!child) {
          child = this.createDirectoryNode()
          child.fromAsar = true
          node.children.set(part, child)
        }
        node = child
      }

      // 创建文件节点（懒加载，不立即读取内容）
      const fileName = parts[parts.length - 1]
      if (fileName && node.children) {
        const fileNode: FileNode = {
          type: FileType.File as 1,
          size: file.size || 0,
          ctime: Date.now(),
          mtime: Date.now(),
          version: 1,
          fromAsar: true,
          asarOffset: file.fileOffset
        }
        node.children.set(fileName, fileNode)
      }
    }
  }

  /** 清空文件系统 */
  clear(): void {
    this.root = this.createDirectoryNode()
    this.asarData = null
    this.asarId = null
  }

  /** 获取当前 ASAR ID */
  getAsarId(): string | null {
    return this.asarId
  }

  // ========== FileSystem 接口实现 ==========

  async copy(source: string, target: string, options?: { overwrite: boolean }): Promise<void> {
    const sourceNode = this.getNode(source)
    if (!sourceNode) {
      throw new Error(`Source not found: ${source}`)
    }

    const targetNode = this.getNode(target)
    if (targetNode && !options?.overwrite) {
      throw new Error(`Target already exists: ${target}`)
    }

    // 读取源文件内容
    const content = await this.readFile(source)
    await this.writeFile(target, content)
  }

  async createDirectory(dir: string): Promise<void> {
    const parts = this.getPathParts(dir)
    let node = this.root

    for (const part of parts) {
      if (!node.children) {
        node.children = new Map()
      }
      let child = node.children.get(part)
      if (!child) {
        child = this.createDirectoryNode()
        node.children.set(part, child)
        this.notifyWatchers('create', dir, FileType.Directory)
      }
      node = child
    }
  }

  async delete(filename: string, options?: { recursive: boolean }): Promise<void> {
    const parentPath = this.getParentPath(filename)
    const name = this.getFileName(filename)
    const parent = this.getNode(parentPath)

    if (!parent || !parent.children) {
      throw new Error(`Not found: ${filename}`)
    }

    const node = parent.children.get(name)
    if (!node) {
      throw new Error(`Not found: ${filename}`)
    }

    if (node.type === FileType.Directory && node.children?.size && !options?.recursive) {
      throw new Error(`Directory not empty: ${filename}`)
    }

    parent.children.delete(name)
    this.notifyWatchers('remove', filename, node.type)
  }

  async readDirectory(filename: string): Promise<[string, number][]> {
    const node = this.getNode(filename)
    if (!node) {
      throw new Error(`Not found: ${filename}`)
    }

    if (node.type !== FileType.Directory || !node.children) {
      throw new Error(`Not a directory: ${filename}`)
    }

    const result: [string, number][] = []
    for (const [name, child] of node.children) {
      result.push([name, child.type])
    }

    return result.sort((a, b) => {
      // 目录优先
      if (a[1] !== b[1]) {
        return a[1] === FileType.Directory ? -1 : 1
      }
      return a[0].localeCompare(b[0])
    })
  }

  async readFile(filename: string): Promise<Uint8Array> {
    const node = this.getNode(filename)
    if (!node) {
      throw new Error(`Not found: ${filename}`)
    }

    if (node.type !== FileType.File) {
      throw new Error(`Not a file: ${filename}`)
    }

    // 如果内容已加载，直接返回
    if (node.content) {
      return node.content
    }

    // 懒加载：在 WebWorker 中从 ASAR 读取
    if (node.fromAsar && this.asarData) {
      const content = await extractFileAsync(this.asarData, '/' + this.normalizePath(filename))
      node.content = new Uint8Array(content)
      return node.content
    }

    throw new Error(`Content not available: ${filename}`)
  }

  async readTextFile(filename: string): Promise<string> {
    const content = await this.readFile(filename)
    return new TextDecoder('utf-8').decode(content)
  }

  async rename(oldName: string, newName: string, options?: { overwrite: boolean }): Promise<void> {
    await this.copy(oldName, newName, options)
    await this.delete(oldName, { recursive: true })
  }

  async stat(filename: string): Promise<FileStat> {
    const node = this.getNode(filename)
    if (!node) {
      throw new Error(`Not found: ${filename}`)
    }

    return {
      type: node.type as 0 | 1 | 2 | 64,
      ctime: node.ctime,
      mtime: node.mtime,
      version: node.version,
      size: node.size
    }
  }

  async writeFile(
    filename: string,
    content: string | Uint8Array,
    context?: FileSystemWatchContext
  ): Promise<void> {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content

    const parent = this.getOrCreateParent(filename)
    const name = this.getFileName(filename)

    if (!parent.children) {
      parent.children = new Map()
    }

    const existingNode = parent.children.get(name)
    const isCreate = !existingNode
    const now = Date.now()

    const fileNode: FileNode =
      existingNode && existingNode.type === FileType.File
        ? {
            ...existingNode,
            content: data,
            size: data.length,
            mtime: now,
            version: existingNode.version + 1,
            fromAsar: false
          }
        : this.createFileNode(data, false)

    parent.children.set(name, fileNode)

    this.notifyWatchers(isCreate ? 'create' : 'modify', filename, FileType.File, context)
  }

  watch(
    filename: string,
    optionsOrHandle: { recursive: boolean } | FileSystemWatchHandle,
    handle?: FileSystemWatchHandle
  ): () => void {
    let options: { recursive: boolean }
    let callback: FileSystemWatchHandle

    if (typeof optionsOrHandle === 'function') {
      options = { recursive: false }
      callback = optionsOrHandle
    } else {
      options = optionsOrHandle
      callback = handle!
    }

    const watcher: FileWatcher = {
      path: this.normalizePath(filename),
      recursive: options.recursive,
      handle: callback
    }

    this.watchers.push(watcher)

    // 返回取消监听的函数
    return () => {
      const index = this.watchers.indexOf(watcher)
      if (index !== -1) {
        this.watchers.splice(index, 1)
      }
    }
  }

  // ========== 扩展方法 ==========

  /** 检查文件是否已修改 */
  isModified(filename: string): boolean {
    const node = this.getNode(filename)
    return node ? !node.fromAsar : false
  }

  /** 获取所有已修改的文件路径 */
  getModifiedFiles(): string[] {
    const result: string[] = []

    const traverse = (node: FileNode, path: string) => {
      if (node.type === FileType.File && !node.fromAsar) {
        result.push(path)
      }
      if (node.children) {
        for (const [name, child] of node.children) {
          traverse(child, path ? `${path}/${name}` : name)
        }
      }
    }

    traverse(this.root, '')
    return result
  }

  /** 重置文件到原始状态 */
  async resetFile(filename: string): Promise<void> {
    if (!this.asarData || !this.asarId) {
      throw new Error('No ASAR loaded')
    }

    const node = this.getNode(filename)
    if (!node || node.type !== FileType.File) {
      throw new Error(`Not a file: ${filename}`)
    }

    // 在 WebWorker 中从 ASAR 重新读取
    const content = await extractFileAsync(this.asarData, '/' + this.normalizePath(filename))
    node.content = new Uint8Array(content)
    node.fromAsar = true
    node.mtime = Date.now()
    node.version++

    this.notifyWatchers('modify', filename, FileType.File)
  }

  /** 获取文件树结构 */
  getFileTree(): {
    name: string
    path: string
    isDirectory: boolean
    children?: unknown[]
    size?: number
    modified?: boolean
  }[] {
    const buildTree = (
      node: FileNode,
      path: string
    ): {
      name: string
      path: string
      isDirectory: boolean
      children?: unknown[]
      size?: number
      modified?: boolean
    }[] => {
      if (!node.children) return []

      const result: {
        name: string
        path: string
        isDirectory: boolean
        children?: unknown[]
        size?: number
        modified?: boolean
      }[] = []

      for (const [name, child] of node.children) {
        const fullPath = path ? `${path}/${name}` : name
        const item: {
          name: string
          path: string
          isDirectory: boolean
          children?: unknown[]
          size?: number
          modified?: boolean
        } = {
          name,
          path: '/' + fullPath,
          isDirectory: child.type === FileType.Directory
        }

        if (child.type === FileType.Directory) {
          item.children = buildTree(child, fullPath)
        } else {
          item.size = child.size
          item.modified = !child.fromAsar
        }

        result.push(item)
      }

      return result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    }

    return buildTree(this.root, '')
  }
}
