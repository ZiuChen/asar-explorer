/**
 * ASAR Worker Client - 主线程与 Worker 通信的客户端
 */

import type { WorkerRequest, WorkerResponse } from './worker'
import type { FullFileMetadata } from './types'

// Worker 实例
let worker: Worker | null = null
let requestId = 0
const pendingRequests = new Map<
  number,
  {
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
  }
>()

/** 获取或创建 Worker */
function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data
      const pending = pendingRequests.get(response.id)
      if (pending) {
        pendingRequests.delete(response.id)
        if (response.type === 'error') {
          pending.reject(new Error(response.error))
        } else {
          pending.resolve(response.result)
        }
      }
    }
    worker.onerror = (error) => {
      console.error('Worker error:', error)
    }
  }
  return worker
}

/** 发送请求到 Worker */
function sendRequest<T>(
  type: WorkerRequest['type'],
  payload: Record<string, unknown>,
  transfer?: Transferable[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject })
    const fullRequest = { type, id, ...payload }
    if (transfer) {
      getWorker().postMessage(fullRequest, transfer)
    } else {
      getWorker().postMessage(fullRequest)
    }
  })
}

/** 解析 ASAR 头部（在 Worker 中执行） */
export async function parseHeaderAsync(data: ArrayBuffer): Promise<{
  files: FullFileMetadata[]
  filesOffset: number
}> {
  // 复制数据以便传输
  const copy = data.slice(0)
  return sendRequest('parseHeader', { data: copy }, [copy])
}

/** 提取单个文件（在 Worker 中执行） */
export async function extractFileAsync(data: ArrayBuffer, path: string): Promise<ArrayBuffer> {
  return sendRequest('extractFile', { data, path })
}

/** 批量提取文件（在 Worker 中执行） */
export async function extractFilesAsync(
  data: ArrayBuffer,
  paths: string[]
): Promise<Record<string, ArrayBuffer>> {
  return sendRequest('extractFiles', { data, paths })
}

/** 修改并重新打包（在 Worker 中执行） */
export async function modifyPackageAsync(
  data: ArrayBuffer,
  modifications: Record<string, Uint8Array>
): Promise<Uint8Array> {
  // 复制数据以便传输
  const copy = data.slice(0)
  return sendRequest('modifyPackage', { data: copy, modifications }, [copy])
}

/** 终止 Worker */
export function terminateWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pendingRequests.clear()
  }
}
