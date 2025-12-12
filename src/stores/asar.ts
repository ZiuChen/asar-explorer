/**
 * ASAR Explorer Store
 * 使用 VueUse createGlobalState 管理全局状态
 */

import { ref, shallowRef, computed } from 'vue'
import { createGlobalState } from '@vueuse/core'
import type { AsarMeta, FileTreeNode } from '@/types/asar'
import { AsarFileSystem } from '@/utils/asar-filesystem'
import { modifyPackageAsync } from '@/lib/asar-browser'
import { prefixedNanoid } from '@/utils/crypto'

/** 使用 createGlobalState 创建全局状态 */
export const useAsarStore = createGlobalState(() => {
  // ========== 单例实例 ==========

  /** ASAR 文件系统实例 */
  const asarFS = new AsarFileSystem()

  /** 当前加载的 ASAR 原始数据 */
  let currentAsarData: ArrayBuffer | null = null

  // ========== 响应式状态 ==========

  /** 当前加载的 ASAR 元信息 */
  const currentAsar = ref<AsarMeta | null>(null)

  /** 文件树 */
  const fileTree = shallowRef<FileTreeNode[]>([])

  /** 当前打开的文件路径 */
  const currentFile = ref<string | null>(null)

  /** 是否正在加载 ASAR */
  const isLoadingAsar = ref(false)

  /** 是否正在保存 */
  const isSaving = ref(false)

  /** 是否正在重新打包 */
  const isRepacking = ref(false)

  /** 错误信息 */
  const error = ref<string | null>(null)

  /** 修改的文件集合 */
  const modifiedFiles = ref<Set<string>>(new Set())

  // ========== 计算属性 ==========

  /** 是否有修改 */
  const hasModifications = computed(() => modifiedFiles.value.size > 0)

  /** 是否已加载 ASAR */
  const asarLoaded = computed(() => currentAsar.value !== null)

  // ========== ASAR 操作 ==========

  /**
   * 从文件加载 ASAR
   */
  async function loadFromFile(file: File): Promise<void> {
    try {
      isLoadingAsar.value = true
      error.value = null

      const buffer = await file.arrayBuffer()
      await loadAsarData(buffer, file.name)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoadingAsar.value = false
    }
  }

  /**
   * 从 URL 加载 ASAR
   */
  async function loadFromUrl(url: string): Promise<void> {
    try {
      isLoadingAsar.value = true
      error.value = null

      let buffer: ArrayBuffer
      let fileName: string

      if (url.startsWith('data:')) {
        // 处理 Data URL
        fileName = 'data-url.asar'
        const base64 = url.split(',')[1] || ''
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        buffer = bytes.buffer
      } else {
        // 从 URL 获取
        const urlObj = new URL(url)
        fileName = urlObj.pathname.split('/').pop() || 'remote.asar'

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        buffer = await response.arrayBuffer()
      }

      await loadAsarData(buffer, fileName)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoadingAsar.value = false
    }
  }

  /**
   * 加载 ASAR 数据的内部方法
   */
  async function loadAsarData(data: ArrayBuffer, fileName: string): Promise<void> {
    const asarId = prefixedNanoid('R')

    // 保存原始数据
    currentAsarData = data

    // 创建元信息
    const meta: AsarMeta = {
      id: asarId,
      name: fileName,
      size: data.byteLength,
      importedAt: Date.now(),
      lastModifiedAt: Date.now()
    }

    // 加载到文件系统
    await asarFS.loadFromAsar(data, asarId)

    // 更新状态
    currentAsar.value = meta
    fileTree.value = asarFS.getFileTree() as FileTreeNode[]
    modifiedFiles.value = new Set()
    currentFile.value = null
  }

  /**
   * 关闭当前 ASAR
   */
  function closeAsar(): void {
    asarFS.clear()
    currentAsar.value = null
    currentAsarData = null
    fileTree.value = []
    modifiedFiles.value = new Set()
    currentFile.value = null
  }

  // ========== 文件操作 ==========

  /**
   * 打开文件
   * 更新 currentFile 状态，实际打开文件由 monaco-editor 组件的 watch 处理
   */
  async function openFile(path: string): Promise<void> {
    // 更新当前文件路径，monaco-editor 组件会监听此变化并打开文件
    currentFile.value = path
  }

  /**
   * 保存当前文件
   */
  async function saveCurrentFile(): Promise<void> {
    // 更新修改文件列表
    modifiedFiles.value = new Set(asarFS.getModifiedFiles())
    // 更新文件树（刷新修改状态）
    fileTree.value = asarFS.getFileTree() as FileTreeNode[]
  }

  /**
   * 重置文件到原始状态
   */
  async function resetFile(path: string): Promise<void> {
    try {
      await asarFS.resetFile(path.replace(/^\/+/, ''))
      modifiedFiles.value = new Set(asarFS.getModifiedFiles())
      fileTree.value = asarFS.getFileTree() as FileTreeNode[]

      // 如果是当前打开的文件，重新打开以刷新内容
      if (currentFile.value === path) {
        await openFile(path)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  /**
   * 重置所有文件
   */
  async function resetAllFiles(): Promise<void> {
    if (!currentAsar.value || !currentAsarData) return

    try {
      // 重新加载 ASAR
      await asarFS.loadFromAsar(currentAsarData, currentAsar.value.id)
      fileTree.value = asarFS.getFileTree() as FileTreeNode[]
      modifiedFiles.value = new Set()

      // 重新打开当前文件
      if (currentFile.value) {
        await openFile(currentFile.value)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  // ========== 导出操作 ==========

  /**
   * 下载修改后的 ASAR
   */
  async function downloadModifiedAsar(): Promise<void> {
    if (!currentAsar.value || !currentAsarData) {
      throw new Error('No ASAR loaded')
    }

    try {
      isRepacking.value = true
      error.value = null

      // 收集所有修改
      const modificationMap: Record<string, Uint8Array> = {}
      const modifiedPaths = asarFS.getModifiedFiles()

      for (const path of modifiedPaths) {
        const content = await asarFS.readFile(path)
        if (content) {
          modificationMap[path] = content
        }
      }

      // 在 WebWorker 中重新打包
      const newAsarData = await modifyPackageAsync(currentAsarData, modificationMap)

      // 创建下载
      const blob = new Blob([newAsarData.buffer as ArrayBuffer], {
        type: 'application/octet-stream'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = currentAsar.value.name.replace('.asar', '-modified.asar')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isRepacking.value = false
    }
  }

  /**
   * 下载原始 ASAR
   */
  async function downloadOriginalAsar(): Promise<void> {
    if (!currentAsar.value || !currentAsarData) {
      throw new Error('No ASAR loaded')
    }

    const blob = new Blob([currentAsarData], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = currentAsar.value.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ========== 辅助方法 ==========

  /**
   * 获取 FileSystem 实例
   */
  function getFileSystem(): AsarFileSystem {
    return asarFS
  }

  /**
   * 刷新文件树
   */
  function refreshFileTree(): void {
    fileTree.value = asarFS.getFileTree() as FileTreeNode[]
    modifiedFiles.value = new Set(asarFS.getModifiedFiles())
  }

  return {
    // 状态
    currentAsar,
    fileTree,
    currentFile,
    isLoadingAsar,
    isSaving,
    isRepacking,
    error,
    modifiedFiles,
    // 计算属性
    hasModifications,
    asarLoaded,
    // 方法
    loadFromFile,
    loadFromUrl,
    closeAsar,
    openFile,
    saveCurrentFile,
    resetFile,
    resetAllFiles,
    downloadModifiedAsar,
    downloadOriginalAsar,
    getFileSystem,
    refreshFileTree
  }
})
