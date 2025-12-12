/**
 * History Persistence using idb
 * 使用 idb 库操作 IndexedDB 存储 ASAR 历史记录
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AsarMeta, AsarSnapshot, FileModification, AsarHistoryItem } from '@/types/asar'

const DB_NAME = 'asar-explorer'
const DB_VERSION = 1

/** 数据库 Schema 定义 */
interface AsarExplorerDB extends DBSchema {
  asars: {
    key: string
    value: AsarMeta
    indexes: {
      'by-name': string
      'by-importedAt': number
      'by-hash': string
    }
  }
  'asar-data': {
    key: string
    value: { id: string; data: Uint8Array }
  }
  snapshots: {
    key: string
    value: AsarSnapshot
    indexes: {
      'by-asarId': string
      'by-createdAt': number
    }
  }
  modifications: {
    key: string
    value: FileModification
    indexes: {
      'by-asarId': string
      'by-snapshotId': string
      'by-path': string
      'by-asarId-path': [string, string]
    }
  }
}

/** 获取数据库实例 */
let dbPromise: Promise<IDBPDatabase<AsarExplorerDB>> | null = null

function getDB(): Promise<IDBPDatabase<AsarExplorerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AsarExplorerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // ASAR 元信息存储
        if (!db.objectStoreNames.contains('asars')) {
          const asarStore = db.createObjectStore('asars', { keyPath: 'id' })
          asarStore.createIndex('by-name', 'name')
          asarStore.createIndex('by-importedAt', 'importedAt')
          asarStore.createIndex('by-hash', 'hash')
        }

        // ASAR 原始数据存储
        if (!db.objectStoreNames.contains('asar-data')) {
          db.createObjectStore('asar-data', { keyPath: 'id' })
        }

        // 快照存储
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' })
          snapshotStore.createIndex('by-asarId', 'asarId')
          snapshotStore.createIndex('by-createdAt', 'createdAt')
        }

        // 文件修改存储
        if (!db.objectStoreNames.contains('modifications')) {
          const modStore = db.createObjectStore('modifications', { keyPath: 'id' })
          modStore.createIndex('by-asarId', 'asarId')
          modStore.createIndex('by-snapshotId', 'snapshotId')
          modStore.createIndex('by-path', 'path')
          modStore.createIndex('by-asarId-path', ['asarId', 'path'])
        }
      }
    })
  }
  return dbPromise
}

// ========== ASAR 操作 ==========

/** 保存 ASAR 元信息和数据 */
export async function saveAsar(meta: AsarMeta, data: ArrayBuffer): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['asars', 'asar-data'], 'readwrite')
  await Promise.all([
    tx.objectStore('asars').put(meta),
    tx.objectStore('asar-data').put({ id: meta.id, data: new Uint8Array(data) }),
    tx.done
  ])
}

/** 获取 ASAR 元信息 */
export async function getAsarMeta(id: string): Promise<AsarMeta | undefined> {
  const db = await getDB()
  return db.get('asars', id)
}

/** 获取 ASAR 数据 */
export async function getAsarData(id: string): Promise<ArrayBuffer | null> {
  const db = await getDB()
  const result = await db.get('asar-data', id)
  return result ? (result.data.buffer as ArrayBuffer) : null
}

/** 获取所有 ASAR 历史记录 */
export async function getAllAsarHistory(): Promise<AsarHistoryItem[]> {
  const db = await getDB()

  // 获取所有 ASAR 按导入时间倒序
  const asars = await db.getAllFromIndex('asars', 'by-importedAt')
  asars.reverse()

  const results: AsarHistoryItem[] = []

  for (const meta of asars) {
    // 获取快照数量
    const snapshotCount = await db.countFromIndex('snapshots', 'by-asarId', meta.id)

    // 获取修改文件数量
    const modifiedFileCount = await db.countFromIndex('modifications', 'by-asarId', meta.id)

    results.push({
      ...meta,
      snapshotCount,
      modifiedFileCount
    })
  }

  return results
}

/** 根据哈希查找已存在的 ASAR */
export async function findAsarByHash(hash: string): Promise<AsarMeta | undefined> {
  const db = await getDB()
  return db.getFromIndex('asars', 'by-hash', hash)
}

/** 删除 ASAR 及其所有相关数据 */
export async function deleteAsar(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['asars', 'asar-data', 'snapshots', 'modifications'], 'readwrite')

  // 删除 ASAR 元信息和数据
  await tx.objectStore('asars').delete(id)
  await tx.objectStore('asar-data').delete(id)

  // 删除相关快照
  const snapshotIndex = tx.objectStore('snapshots').index('by-asarId')
  let snapshotCursor = await snapshotIndex.openCursor(id)
  while (snapshotCursor) {
    await snapshotCursor.delete()
    snapshotCursor = await snapshotCursor.continue()
  }

  // 删除相关文件修改
  const modIndex = tx.objectStore('modifications').index('by-asarId')
  let modCursor = await modIndex.openCursor(id)
  while (modCursor) {
    await modCursor.delete()
    modCursor = await modCursor.continue()
  }

  await tx.done
}

// ========== 快照操作 ==========

/** 创建快照 */
export async function createSnapshotRecord(snapshot: AsarSnapshot): Promise<void> {
  const db = await getDB()
  await db.add('snapshots', snapshot)
}

/** 获取 ASAR 的所有快照 */
export async function getSnapshots(asarId: string): Promise<AsarSnapshot[]> {
  const db = await getDB()
  const snapshots = await db.getAllFromIndex('snapshots', 'by-asarId', asarId)
  return snapshots.sort((a, b) => b.createdAt - a.createdAt)
}

/** 删除快照 */
export async function deleteSnapshotRecord(id: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['snapshots', 'modifications'], 'readwrite')

  // 删除快照
  await tx.objectStore('snapshots').delete(id)

  // 删除关联的文件修改
  const modIndex = tx.objectStore('modifications').index('by-snapshotId')
  let cursor = await modIndex.openCursor(id)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}

// ========== 文件修改操作 ==========

/** 保存文件修改 */
export async function saveModification(modification: FileModification): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('modifications', 'readwrite')
  const store = tx.objectStore('modifications')
  const index = store.index('by-asarId-path')

  // 先删除同路径的旧修改
  let cursor = await index.openCursor([modification.asarId, modification.path])
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  // 添加新修改
  await store.add(modification)
  await tx.done
}

/** 获取文件的最新修改 */
export async function getModification(
  asarId: string,
  path: string
): Promise<FileModification | undefined> {
  const db = await getDB()
  return db.getFromIndex('modifications', 'by-asarId-path', [asarId, path])
}

/** 获取 ASAR 的所有修改 */
export async function getAllModifications(asarId: string): Promise<FileModification[]> {
  const db = await getDB()
  return db.getAllFromIndex('modifications', 'by-asarId', asarId)
}

/** 删除文件修改 */
export async function deleteModification(asarId: string, path: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('modifications', 'readwrite')
  const index = tx.objectStore('modifications').index('by-asarId-path')

  let cursor = await index.openCursor([asarId, path])
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}

/** 清除 ASAR 的所有修改 */
export async function clearModifications(asarId: string): Promise<void> {
  const db = await getDB()
  const tx = db.transaction('modifications', 'readwrite')
  const index = tx.objectStore('modifications').index('by-asarId')

  let cursor = await index.openCursor(asarId)
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
}

/** 历史记录 API 对象（兼容旧接口） */
export const historyDB = {
  saveAsar,
  getAsarMeta,
  getAsarData,
  getAllAsarHistory,
  findAsarByHash,
  deleteAsar,
  createSnapshot: createSnapshotRecord,
  getSnapshots,
  deleteSnapshot: deleteSnapshotRecord,
  saveModification,
  getModification,
  getAllModifications,
  deleteModification,
  clearModifications
}
