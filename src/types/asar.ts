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
