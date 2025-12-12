/**
 * ASAR Extractor - 提取 ASAR 文件内容
 * 基于 https://github.com/Banou26/asar-browser
 */

import type {
  FileData,
  DirectoryMetadata,
  FileMetadata,
  Metadata,
  FullFileMetadata,
  ListPackageMetadataReturn,
  AsarHeader,
  ExtractPackageReturn
} from './types'

// 重导出类型供其他模块使用
export type { FullFileMetadata } from './types'

import { isDirectoryMetadata, joinPath, dirname, basename, PATH_SEP } from './utils'

/** 列表选项 */
export interface ListPackageOptions {
  flat?: boolean
}

/** 将 FileData 转换为 ArrayBuffer */
const getArrayBuffer = async (data: FileData): Promise<ArrayBuffer> => {
  if (data instanceof ArrayBuffer) {
    return data
  }
  if (data instanceof Uint8Array) {
    // 创建一个新的 ArrayBuffer 副本
    const copy = new Uint8Array(data)
    return copy.buffer as ArrayBuffer
  }
  if (data instanceof Blob) {
    return data.arrayBuffer()
  }
  // string
  return new Blob([data]).arrayBuffer()
}

/** 扁平化列出子元数据 */
const flatListChildMetadata = ({
  basePath,
  metadata,
  filesOffset
}: {
  basePath: string
  metadata: DirectoryMetadata
  filesOffset: number
}): FullFileMetadata[] =>
  Object.entries(metadata.files).flatMap(([key, value]) =>
    isDirectoryMetadata(value)
      ? flatListChildMetadata({
          basePath: joinPath(basePath, key),
          metadata: value,
          filesOffset
        })
      : {
          path: joinPath(basePath, key),
          offset: Number((value as FileMetadata).offset),
          size: (value as FileMetadata).size,
          fileOffset: filesOffset + 8 + Number((value as FileMetadata).offset)
        }
  )

/** 嵌套列出子元数据 */
const listChildsNestedMetadata = ({
  basePath,
  metadata,
  filesOffset
}: {
  basePath: string
  metadata: DirectoryMetadata | FileMetadata
  filesOffset: number
}): ListPackageMetadataReturn | FullFileMetadata => {
  if (isDirectoryMetadata(metadata)) {
    return Object.fromEntries(
      Object.entries(metadata.files).map(([key, value]) => [
        key,
        listChildsNestedMetadata({
          basePath: joinPath(basePath, key),
          metadata: value,
          filesOffset
        })
      ])
    ) as ListPackageMetadataReturn
  }
  return {
    path: basePath,
    offset: Number(metadata.offset),
    size: metadata.size,
    fileOffset: filesOffset + 8 + Number(metadata.offset)
  } as FullFileMetadata
}

/** 根据选项列出子项 */
const listChilds = <T extends boolean>({
  flat,
  header,
  filesOffset
}: {
  flat: T
  header: DirectoryMetadata
  filesOffset: number
}): T extends true ? FullFileMetadata[] : ListPackageMetadataReturn =>
  (flat
    ? flatListChildMetadata({ metadata: header, basePath: '/', filesOffset })
    : listChildsNestedMetadata({
        metadata: header,
        basePath: '/',
        filesOffset
      })) as T extends true ? FullFileMetadata[] : ListPackageMetadataReturn

/** 从目录中搜索节点 */
const searchNodeFromDirectory = (header: Metadata, p: string): Metadata | undefined => {
  let json: Metadata | undefined = header
  const dirs = p.split(PATH_SEP).filter(Boolean)
  for (const dir of dirs) {
    if (dir !== '.' && json) {
      json = (json as DirectoryMetadata).files?.[dir]
    }
  }
  return json
}

/** 从路径中搜索节点 */
const searchNodeFromPath = (
  header: DirectoryMetadata,
  p: string
): FileMetadata | DirectoryMetadata => {
  p = p.replace(/^\//, '')
  if (!p) {
    return header
  }
  const name = basename(p)
  const node = searchNodeFromDirectory(header, dirname(p)) as DirectoryMetadata
  if (!node.files) {
    node.files = {}
  }
  if (!node.files[name]) {
    node.files[name] = {}
  }
  return node.files[name]
}

/** 同步读取 ASAR 头部 */
export const readArchiveHeaderSync = (
  archiveArrayBuffer: ArrayBuffer
): { header: DirectoryMetadata; headerSize: number } => {
  const dataView = new DataView(archiveArrayBuffer)
  const size = dataView.getUint32(4, true)
  const headerSize = dataView.getInt32(12, true)
  const headerBytes = new Uint8Array(archiveArrayBuffer, 16, headerSize)
  const header = new TextDecoder('utf-8').decode(headerBytes)
  return {
    header: JSON.parse(header),
    headerSize: size
  }
}

/** 提取单个文件 */
export const extractFile = async (archive: FileData, pathname: string): Promise<ArrayBuffer> => {
  const buffer = await getArrayBuffer(archive)
  const dataView = new DataView(buffer)
  const size = dataView.getUint32(4, true)
  const headerSize = dataView.getUint32(12, true)
  const headerBuffer = buffer.slice(16, headerSize + 16)
  const headerString = new TextDecoder('utf-8').decode(headerBuffer)
  const header: DirectoryMetadata = JSON.parse(headerString)
  const node = searchNodeFromPath(header, pathname) as FileMetadata
  const { offset, size: payloadSize } = node
  return buffer.slice(size + Number(offset) + 8, size + Number(offset) + (payloadSize || 0) + 8)
}

/** 获取 ASAR 头部信息 */
export const getHeader = async <T extends ListPackageOptions>(
  bodyInit: FileData,
  options?: T
): Promise<AsarHeader<NonNullable<T['flat']>>> => {
  const buffer = await getArrayBuffer(bodyInit)
  const dataView = new DataView(buffer)
  const size = dataView.getUint32(4, true)
  const headerSize = dataView.getUint32(12, true)
  const headerBuffer = buffer.slice(16, headerSize + 16)
  const headerString = new TextDecoder('utf-8').decode(headerBuffer)
  const header: DirectoryMetadata = JSON.parse(headerString)

  return {
    headerSize,
    filesOffset: size,
    header: listChilds({
      flat: options?.flat ?? false,
      header,
      filesOffset: size
    })
  } as AsarHeader<NonNullable<T['flat']>>
}

/** 获取原始头部 JSON */
export const getRawHeader = async (archive: FileData): Promise<DirectoryMetadata> => {
  const buffer = await getArrayBuffer(archive)
  const dataView = new DataView(buffer)
  const headerSize = dataView.getUint32(12, true)
  const headerBuffer = buffer.slice(16, headerSize + 16)
  const headerString = new TextDecoder('utf-8').decode(headerBuffer)
  return JSON.parse(headerString)
}

/** 列出包内所有文件路径 */
export const listPackage = async (archive: FileData): Promise<string[]> => {
  const { header } = await getHeader(archive, { flat: true })
  return (header as FullFileMetadata[]).map((f) => f.path)
}

/** 提取所有文件 */
export const extractAll = async <T extends ListPackageOptions>(
  archive: FileData,
  options?: T
): Promise<{ [key: string]: ArrayBuffer } | ExtractPackageReturn> => {
  const buffer = await getArrayBuffer(archive)
  const { header } = await getHeader(buffer, { flat: options?.flat })

  if (options?.flat) {
    return Object.fromEntries(
      await Promise.all(
        (header as FullFileMetadata[]).map(async ({ path }) => [
          path,
          await extractFile(buffer, path)
        ])
      )
    )
  }

  const extractFolder = async (folder: ListPackageMetadataReturn): Promise<ExtractPackageReturn> =>
    Object.fromEntries(
      await Promise.all(
        Object.entries(folder).map(async ([key, value]) => {
          if ('path' in value) {
            // It's a FullFileMetadata
            return [key, await extractFile(buffer, (value as FullFileMetadata).path)]
          } else {
            // It's a nested folder
            return [key, await extractFolder(value as ListPackageMetadataReturn)]
          }
        })
      )
    )

  return extractFolder(header as ListPackageMetadataReturn)
}

/** 读取文件为文本 */
export const readFileAsText = async (archive: FileData, pathname: string): Promise<string> => {
  const buffer = await extractFile(archive, pathname)
  return new TextDecoder('utf-8').decode(buffer)
}

/** 读取文件为 Uint8Array */
export const readFileAsUint8Array = async (
  archive: FileData,
  pathname: string
): Promise<Uint8Array> => {
  const buffer = await extractFile(archive, pathname)
  return new Uint8Array(buffer)
}
