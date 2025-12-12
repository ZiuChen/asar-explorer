/**
 * ASAR Browser Types
 * 基于 https://github.com/Banou26/asar-browser
 */

/** 文件数据类型 - 支持多种输入格式 */
export type FileData = string | ArrayBuffer | Uint8Array | Blob

/** 未打包的文件结构 */
export interface UnpackedFiles {
  [key: string]: UnpackedFiles | FileData
}

/** 未打包的目录结构 */
export type UnpackedDirectory = {
  files: { [property: string]: FileData | UnpackedDirectory }
}

/** 文件元数据 */
export interface FileMetadata {
  offset?: string
  size?: number
}

/** 目录元数据 */
export type DirectoryMetadata = {
  files: { [property: string]: FileMetadata | DirectoryMetadata }
}

/** 元数据类型 */
export type Metadata = DirectoryMetadata | FileMetadata

/** 完整文件元数据 */
export type FullFileMetadata = Omit<FileMetadata, 'offset'> & {
  offset: number
  path: string
  fileOffset: number
}

/** 列出包元数据的返回类型 */
export interface ListPackageMetadataReturn {
  [key: string]: FullFileMetadata | ListPackageMetadataReturn
}

/** ASAR 头部信息 */
export interface AsarHeader<T = false> {
  headerSize: number
  filesOffset: number
  header: T extends true ? FullFileMetadata[] : ListPackageMetadataReturn
}

/** 提取包的返回类型 */
export interface ExtractPackageReturn {
  [key: string]: ArrayBuffer | ExtractPackageReturn
}
