/**
 * ASAR Packager - 创建 ASAR 文件
 * 基于 https://github.com/Banou26/asar-browser
 */

import type { UnpackedFiles, FileMetadata, DirectoryMetadata, FileData } from './types'

import { createEmpty } from './pickle'
import { isDirectory, isDirectoryMetadata, PATH_SEP } from './utils'

/** 将扁平路径树转换为嵌套树 */
const makeFlatTree = (files: UnpackedFiles): UnpackedFiles => {
  const tree: UnpackedFiles = {}

  for (const [key, val] of Object.entries(files)) {
    let currDir = tree
    const dirs = key.split(PATH_SEP).filter(Boolean)
    const filename = dirs.pop() as string
    for (const dir of dirs) {
      currDir = (currDir[dir] = currDir[dir] ?? {}) as UnpackedFiles
    }
    currDir[filename] = val
  }
  return tree
}

/** 创建头部树结构 */
const makeHeaderTree = (files: UnpackedFiles): { files: Record<string, unknown> } =>
  Object.entries(files).reduce(
    ({ files }, [key, value]) => ({
      files: {
        ...files,
        [key]: isDirectory(value) ? makeHeaderTree(value as UnpackedFiles) : value
      }
    }),
    { files: {} }
  )

/** 将 FileData 转换为 Uint8Array */
const toUint8Array = async (data: FileData): Promise<Uint8Array> => {
  if (data instanceof Uint8Array) {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (data instanceof Blob) {
    const buffer = await data.arrayBuffer()
    return new Uint8Array(buffer)
  }
  // string
  return new TextEncoder().encode(data)
}

/** 计算每个文件的大小 */
const makeSizeTree = async (tree: {
  files: Record<string, unknown>
}): Promise<DirectoryMetadata> => {
  const result: DirectoryMetadata = { files: {} }

  for (const [key, value] of Object.entries(tree.files)) {
    if (isDirectory(value) && 'files' in (value as Record<string, unknown>)) {
      result.files[key] = await makeSizeTree(value as { files: Record<string, unknown> })
    } else {
      const data = await toUint8Array(value as FileData)
      result.files[key] = { size: data.length } as FileMetadata
    }
  }

  return result
}

/** 为每个文件添加偏移量 */
const makeOffsetTree = (tree: DirectoryMetadata): DirectoryMetadata => {
  const makeInnerOffsetTree = (
    tree: DirectoryMetadata,
    offset: string
  ): [DirectoryMetadata, string] =>
    Object.entries(tree.files).reduce<[DirectoryMetadata, string]>(
      ([{ files }, currentOffset], [key, value]) => {
        const [newValue, newOffset] = isDirectoryMetadata(value)
          ? makeInnerOffsetTree(value, currentOffset)
          : [
              {
                size: (value as FileMetadata).size || 0,
                offset: currentOffset
              } as FileMetadata,
              (Number(currentOffset) + ((value as FileMetadata).size || 0)).toString()
            ]

        return [
          {
            files: {
              ...files,
              [key]: newValue
            }
          },
          newOffset
        ]
      },
      [{ files: {} }, offset || '0']
    )

  return makeInnerOffsetTree(tree, '0')[0]
}

/** 创建头部元数据 */
const makeHeader = async (files: UnpackedFiles): Promise<DirectoryMetadata> =>
  makeOffsetTree(await makeSizeTree(makeHeaderTree(files)))

/** 递归收集所有文件数据 */
const makeFilesBuffer = async (files: UnpackedFiles): Promise<Uint8Array[]> => {
  const result: Uint8Array[] = []

  for (const [, value] of Object.entries(files)) {
    if (isDirectory(value)) {
      const nested = await makeFilesBuffer(value as UnpackedFiles)
      result.push(...nested)
    } else {
      result.push(await toUint8Array(value as FileData))
    }
  }

  return result
}

/** 创建 ASAR 包选项 */
export interface CreatePackageOptions {
  flat?: boolean
}

/**
 * 创建 ASAR 包
 * @param files 文件结构，可以是嵌套对象或扁平路径
 * @param options 选项
 * @returns ASAR 文件的 Uint8Array
 */
export const createPackage = async (
  files: UnpackedFiles,
  options?: CreatePackageOptions
): Promise<Uint8Array> => {
  const normalizedFiles = options?.flat ? makeFlatTree(files) : files
  const header = await makeHeader(normalizedFiles)
  const headerPickle = createEmpty()
  headerPickle.writeString(JSON.stringify(header))
  const headerBuf = headerPickle.toBuffer()

  const sizePickle = createEmpty()
  sizePickle.writeUInt32(headerBuf.length)
  const sizeBuf = sizePickle.toBuffer()

  const fileBuffers = await makeFilesBuffer(normalizedFiles)

  // 计算总长度
  const totalLength =
    sizeBuf.length + headerBuf.length + fileBuffers.reduce((sum, buf) => sum + buf.length, 0)

  // 合并所有缓冲区
  const result = new Uint8Array(totalLength)
  let offset = 0

  result.set(sizeBuf, offset)
  offset += sizeBuf.length

  result.set(headerBuf, offset)
  offset += headerBuf.length

  for (const buf of fileBuffers) {
    result.set(buf, offset)
    offset += buf.length
  }

  return result
}

/**
 * 修改 ASAR 包中的文件
 * 通过解压所有文件，修改指定文件，然后重新打包
 * @param archive 原始 ASAR 数据
 * @param modifications 要修改的文件，键为路径，值为新内容
 * @returns 新的 ASAR 文件 Uint8Array
 */
export const modifyPackage = async (
  archive: FileData,
  modifications: Record<string, FileData>
): Promise<Uint8Array> => {
  // 动态导入 extractor 以避免循环依赖
  const { getHeader, extractFile } = await import('./extractor')

  const { header } = await getHeader(archive, { flat: true })
  const flatHeader = header as Array<{ path: string }>

  // 提取所有文件
  const files: UnpackedFiles = {}
  for (const { path } of flatHeader) {
    const content = await extractFile(archive, path)
    // 使用扁平路径（移除开头的 /）
    const normalizedPath = path.replace(/^\//, '')
    files[normalizedPath] = new Uint8Array(content)
  }

  // 应用修改
  for (const [path, content] of Object.entries(modifications)) {
    const normalizedPath = path.replace(/^\//, '')
    files[normalizedPath] = content
  }

  // 重新打包
  return createPackage(files, { flat: true })
}

/**
 * 添加文件到 ASAR 包
 * @param archive 原始 ASAR 数据
 * @param newFiles 要添加的文件
 * @returns 新的 ASAR 文件 Uint8Array
 */
export const addFilesToPackage = async (
  archive: FileData,
  newFiles: Record<string, FileData>
): Promise<Uint8Array> => {
  return modifyPackage(archive, newFiles)
}

/**
 * 从 ASAR 包删除文件
 * @param archive 原始 ASAR 数据
 * @param pathsToDelete 要删除的文件路径数组
 * @returns 新的 ASAR 文件 Uint8Array
 */
export const deleteFilesFromPackage = async (
  archive: FileData,
  pathsToDelete: string[]
): Promise<Uint8Array> => {
  const { getHeader, extractFile } = await import('./extractor')

  const { header } = await getHeader(archive, { flat: true })
  const flatHeader = header as Array<{ path: string }>

  // 规范化要删除的路径
  const normalizedPathsToDelete = new Set(pathsToDelete.map((p) => p.replace(/^\//, '')))

  // 提取除要删除的文件外的所有文件
  const files: UnpackedFiles = {}
  for (const { path } of flatHeader) {
    const normalizedPath = path.replace(/^\//, '')
    if (!normalizedPathsToDelete.has(normalizedPath)) {
      const content = await extractFile(archive, path)
      files[normalizedPath] = new Uint8Array(content)
    }
  }

  // 重新打包
  return createPackage(files, { flat: true })
}
