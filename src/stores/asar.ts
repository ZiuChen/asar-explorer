/**
 * ASAR Explorer Store
 * 使用 VueUse createGlobalState 管理全局状态
 */

import { ref, shallowRef, computed, markRaw } from 'vue'
import { createGlobalState } from '@vueuse/core'
import type { Workspace } from 'modern-monaco'
import type { AsarMeta, AsarSnapshot, AsarHistoryItem, FileTreeNode } from '@/models/types'
import { AsarFileSystem } from '@/models'
import { modifyPackageAsync } from '@/lib/asar-browser'
import { historyDB, generateId, hashArrayBuffer } from '@/persist/history'

/** 使用 createGlobalState 创建全局状态 */
export const useAsarStore = createGlobalState(() => {
  // ========== 单例实例 ==========

  /** ASAR 文件系统实例 */
  const asarFS = new AsarFileSystem()

  /** Monaco Workspace 实例 */
  let workspace: Workspace | null = null

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

  /** ASAR 历史记录列表 */
  const asarHistory = shallowRef<AsarHistoryItem[]>([])

  /** 当前 ASAR 的快照列表 */
  const snapshots = shallowRef<AsarSnapshot[]>([])

  /** 编辑器是否就绪 */
  const isEditorReady = ref(false)

  // ========== 计算属性 ==========

  /** 是否有修改 */
  const hasModifications = computed(() => modifiedFiles.value.size > 0)

  /** 是否已加载 ASAR */
  const asarLoaded = computed(() => currentAsar.value !== null)

  // ========== 编辑器管理（由 monaco-editor.vue 组件调用） ==========

  /**
   * 设置 Workspace 实例（由组件调用）
   */
  function setWorkspace(ws: Workspace | null): void {
    workspace = ws ? markRaw(ws) : null
  }

  /**
   * 设置编辑器就绪状态（由组件调用）
   */
  function setEditorReady(ready: boolean): void {
    isEditorReady.value = ready
  }

  /**
   * 加载历史记录
   */
  async function loadHistory(): Promise<void> {
    try {
      asarHistory.value = await historyDB.getAllAsarHistory()
    } catch (e) {
      console.error('Failed to load history:', e)
    }
  }

  // ========== ASAR 操作 ==========

  /**
   * 从文件加载 ASAR
   */
  async function loadFromFile(file: File): Promise<void> {
    try {
      isLoadingAsar.value = true
      error.value = null

      const buffer = await file.arrayBuffer()
      await loadAsarData(buffer, file.name, 'file')
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
      let source: 'url' | 'data-url'

      if (url.startsWith('data:')) {
        // 处理 Data URL
        fileName = 'data-url.asar'
        source = 'data-url'
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
        source = 'url'

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
        }
        buffer = await response.arrayBuffer()
      }

      await loadAsarData(buffer, fileName, source, url)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoadingAsar.value = false
    }
  }

  /**
   * 从历史记录加载 ASAR
   */
  async function loadFromHistory(id: string): Promise<void> {
    try {
      isLoadingAsar.value = true
      error.value = null

      const meta = await historyDB.getAsarMeta(id)
      if (!meta) {
        throw new Error('ASAR not found in history')
      }

      const data = await historyDB.getAsarData(id)
      if (!data) {
        throw new Error('ASAR data not found')
      }

      // 加载到文件系统
      await asarFS.loadFromAsar(data, id)

      // 更新状态
      currentAsar.value = meta
      fileTree.value = asarFS.getFileTree() as FileTreeNode[]
      modifiedFiles.value = new Set(asarFS.getModifiedFiles())
      currentFile.value = null

      // 加载快照
      await loadSnapshots()

      // 更新历史记录（更新最后修改时间）
      meta.lastModifiedAt = Date.now()
      await historyDB.saveAsar(meta, data)
      await loadHistory()
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
  async function loadAsarData(
    data: ArrayBuffer,
    fileName: string,
    source: 'file' | 'url' | 'data-url',
    sourceUrl?: string
  ): Promise<void> {
    // 计算哈希
    const hash = await hashArrayBuffer(data)

    // 检查是否已存在
    let existingMeta = await historyDB.findAsarByHash(hash)
    let asarId: string

    if (existingMeta) {
      // 使用已存在的记录
      asarId = existingMeta.id
      existingMeta.lastModifiedAt = Date.now()
      await historyDB.saveAsar(existingMeta, data)
    } else {
      // 创建新记录
      asarId = generateId()
      existingMeta = {
        id: asarId,
        name: fileName,
        size: data.byteLength,
        importedAt: Date.now(),
        lastModifiedAt: Date.now(),
        source,
        sourceUrl,
        hash
      }
      await historyDB.saveAsar(existingMeta, data)
    }

    // 加载到文件系统
    await asarFS.loadFromAsar(data, asarId)

    // 更新状态
    currentAsar.value = existingMeta
    fileTree.value = asarFS.getFileTree() as FileTreeNode[]
    modifiedFiles.value = new Set(asarFS.getModifiedFiles())
    currentFile.value = null

    // 加载快照
    await loadSnapshots()

    // 刷新历史记录
    await loadHistory()
  }

  /**
   * 关闭当前 ASAR
   */
  function closeAsar(): void {
    asarFS.clear()
    currentAsar.value = null
    fileTree.value = []
    modifiedFiles.value = new Set()
    currentFile.value = null
    snapshots.value = []
  }

  // ========== 文件操作 ==========

  /**
   * 打开文件
   */
  async function openFile(path: string): Promise<void> {
    if (!workspace) {
      throw new Error('Editor not initialized')
    }

    try {
      // 规范化路径
      const normalizedPath = path.replace(/^\/+/, '')

      // 在 Monaco 中打开文件
      await workspace.openTextDocument(normalizedPath)
      currentFile.value = path
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
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
    if (!currentAsar.value) return

    try {
      // 清除所有修改
      await historyDB.clearModifications(currentAsar.value.id)

      // 重新加载 ASAR
      const data = await historyDB.getAsarData(currentAsar.value.id)
      if (data) {
        await asarFS.loadFromAsar(data, currentAsar.value.id)
        fileTree.value = asarFS.getFileTree() as FileTreeNode[]
        modifiedFiles.value = new Set()

        // 重新打开当前文件
        if (currentFile.value) {
          await openFile(currentFile.value)
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  // ========== 快照操作 ==========

  /**
   * 加载当前 ASAR 的快照
   */
  async function loadSnapshots(): Promise<void> {
    if (!currentAsar.value) {
      snapshots.value = []
      return
    }

    try {
      snapshots.value = await historyDB.getSnapshots(currentAsar.value.id)
    } catch (e) {
      console.error('Failed to load snapshots:', e)
      snapshots.value = []
    }
  }

  /**
   * 创建快照
   */
  async function createSnapshot(name: string, description?: string): Promise<void> {
    if (!currentAsar.value) {
      throw new Error('No ASAR loaded')
    }

    const snapshot: AsarSnapshot = {
      id: generateId(),
      asarId: currentAsar.value.id,
      name,
      createdAt: Date.now(),
      modifiedFiles: Array.from(modifiedFiles.value),
      description
    }

    await historyDB.createSnapshot(snapshot)
    await loadSnapshots()
  }

  /**
   * 删除快照
   */
  async function deleteSnapshot(id: string): Promise<void> {
    await historyDB.deleteSnapshot(id)
    await loadSnapshots()
  }

  // ========== 导出操作 ==========

  /**
   * 下载修改后的 ASAR
   */
  async function downloadModifiedAsar(): Promise<void> {
    if (!currentAsar.value) {
      throw new Error('No ASAR loaded')
    }

    try {
      isRepacking.value = true
      error.value = null

      // 获取原始数据
      const originalData = await historyDB.getAsarData(currentAsar.value.id)
      if (!originalData) {
        throw new Error('Original ASAR data not found')
      }

      // 收集所有修改
      const modifications = await historyDB.getAllModifications(currentAsar.value.id)
      const modificationMap: Record<string, Uint8Array> = {}

      for (const mod of modifications) {
        modificationMap[mod.path] = mod.content
      }

      // 在 WebWorker 中重新打包
      const newAsarData = await modifyPackageAsync(originalData, modificationMap)

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
    if (!currentAsar.value) {
      throw new Error('No ASAR loaded')
    }

    const data = await historyDB.getAsarData(currentAsar.value.id)
    if (!data) {
      throw new Error('ASAR data not found')
    }

    const blob = new Blob([data], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = currentAsar.value.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ========== 历史记录操作 ==========

  /**
   * 从历史记录中删除 ASAR
   */
  async function deleteFromHistory(id: string): Promise<void> {
    // 如果是当前加载的，先关闭
    if (currentAsar.value?.id === id) {
      closeAsar()
    }

    await historyDB.deleteAsar(id)
    await loadHistory()
  }

  // ========== 辅助方法 ==========

  /**
   * 获取 Workspace 实例
   */
  function getWorkspace(): Workspace | null {
    return workspace
  }

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

  // 在模块加载时初始化历史记录
  loadHistory().catch(console.error)

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
    asarHistory,
    snapshots,
    isEditorReady,
    // 计算属性
    hasModifications,
    asarLoaded,
    // 方法
    setWorkspace,
    setEditorReady,
    loadHistory,
    loadFromFile,
    loadFromUrl,
    loadFromHistory,
    closeAsar,
    openFile,
    saveCurrentFile,
    resetFile,
    resetAllFiles,
    createSnapshot,
    deleteSnapshot,
    downloadModifiedAsar,
    downloadOriginalAsar,
    deleteFromHistory,
    getWorkspace,
    getFileSystem,
    refreshFileTree
  }
})
