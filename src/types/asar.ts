// ASAR 文件条目类型
export interface AsarFileEntry {
  size: number
  offset?: string
  executable?: boolean
  unpacked?: boolean
}

export interface AsarDirectoryEntry {
  files: Record<string, AsarEntry>
}

export type AsarEntry = AsarFileEntry | AsarDirectoryEntry

export interface AsarHeader {
  files: Record<string, AsarEntry>
}

// 文件树节点类型
export interface FileTreeNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileTreeNode[]
  size?: number
  executable?: boolean
}

// 可编辑文件的扩展名
export const EDITABLE_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.md',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.env',
  '.gitignore',
  '.sh',
  '.bash',
  '.py',
  '.sql'
]

// 根据扩展名获取 Monaco 语言
export function getLanguageByExtension(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.ts': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'scss',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.md': 'markdown',
    '.txt': 'plaintext',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.bash': 'shell',
    '.py': 'python',
    '.sql': 'sql'
  }
  return languageMap[ext] || 'plaintext'
}

// 检查文件是否可编辑
export function isFileEditable(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return EDITABLE_EXTENSIONS.includes(ext)
}

// 检查文件是否为文本文件（可预览）
export function isTextFile(filename: string): boolean {
  return isFileEditable(filename)
}
