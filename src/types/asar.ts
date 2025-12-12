/** ASAR 文件元信息 */
export interface AsarMeta {
  /** 唯一标识符 */
  id: string
  /** 文件名 */
  name: string
  /** 文件大小（字节） */
  size: number
  /** 导入时间 */
  importedAt: number
  /** 最后修改时间 */
  lastModifiedAt: number
  /** 来源类型 */
  source: 'file' | 'url' | 'data-url'
  /** 来源 URL（如果是从 URL 加载） */
  sourceUrl?: string
  /** 文件哈希（用于去重） */
  hash?: string
}

/** ASAR 编辑快照 */
export interface AsarSnapshot {
  /** 快照 ID */
  id: string
  /** 关联的 ASAR ID */
  asarId: string
  /** 快照名称 */
  name: string
  /** 创建时间 */
  createdAt: number
  /** 修改的文件路径列表 */
  modifiedFiles: string[]
  /** 快照描述 */
  description?: string
}

/** 文件修改记录 */
export interface FileModification {
  /** 记录 ID */
  id: string
  /** 关联的 ASAR ID */
  asarId: string
  /** 关联的快照 ID（可选） */
  snapshotId?: string
  /** 文件路径 */
  path: string
  /** 修改后的内容 */
  content: Uint8Array
  /** 修改时间 */
  modifiedAt: number
}

/** ASAR 历史记录（用于展示） */
export interface AsarHistoryItem extends AsarMeta {
  /** 快照数量 */
  snapshotCount: number
  /** 修改文件数量 */
  modifiedFileCount: number
}

/** 文件树节点 */
export interface FileTreeNode {
  /** 文件/目录名 */
  name: string
  /** 完整路径 */
  path: string
  /** 是否为目录 */
  isDirectory: boolean
  /** 子节点（目录时有效） */
  children?: FileTreeNode[]
  /** 文件大小（文件时有效） */
  size?: number
  /** 是否已修改 */
  modified?: boolean
}
