/**
 * ASAR Browser Utils
 */

import type { DirectoryMetadata, FileMetadata } from './types'

/** 检查值是否为目录（对象类型） */
export const isDirectory = (val: unknown): val is Record<string, unknown> =>
  !!val &&
  typeof val === 'object' &&
  !ArrayBuffer.isView(val) &&
  !(val instanceof ArrayBuffer) &&
  !(val instanceof Blob)

/** 检查元数据是否为目录元数据 */
export const isDirectoryMetadata = (
  val: DirectoryMetadata | FileMetadata
): val is DirectoryMetadata => isDirectory(val) && 'files' in val && isDirectory(val.files)

/** 路径分隔符 */
export const PATH_SEP = '/'

/** 连接路径 */
export const joinPath = (...parts: string[]): string => {
  return parts.filter(Boolean).join(PATH_SEP).replace(/\/+/g, PATH_SEP)
}

/** 获取路径的目录名 */
export const dirname = (p: string): string => {
  const parts = p.split(PATH_SEP).filter(Boolean)
  parts.pop()
  return parts.join(PATH_SEP) || '.'
}

/** 获取路径的文件名 */
export const basename = (p: string): string => {
  const parts = p.split(PATH_SEP).filter(Boolean)
  return parts[parts.length - 1] || ''
}
