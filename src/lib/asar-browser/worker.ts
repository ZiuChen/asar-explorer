/**
 * ASAR Worker - 在 WebWorker 中处理 ASAR 解析和打包
 * 避免阻塞主线程
 */

import { getHeader, extractFile } from './extractor'
import type { FullFileMetadata } from './types'
import { modifyPackage } from './packager'

export type WorkerRequest =
  | { type: 'parseHeader'; id: number; data: ArrayBuffer }
  | { type: 'extractFile'; id: number; data: ArrayBuffer; path: string }
  | { type: 'extractFiles'; id: number; data: ArrayBuffer; paths: string[] }
  | {
      type: 'modifyPackage'
      id: number
      data: ArrayBuffer
      modifications: Record<string, Uint8Array>
    }

export type WorkerResponse =
  | { type: 'parseHeader'; id: number; result: { files: FullFileMetadata[]; filesOffset: number } }
  | { type: 'extractFile'; id: number; result: ArrayBuffer }
  | { type: 'extractFiles'; id: number; result: Record<string, ArrayBuffer> }
  | { type: 'modifyPackage'; id: number; result: Uint8Array }
  | { type: 'error'; id: number; error: string }

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  try {
    switch (request.type) {
      case 'parseHeader': {
        const { header, filesOffset } = await getHeader(request.data, { flat: true })
        const response: WorkerResponse = {
          type: 'parseHeader',
          id: request.id,
          result: { files: header as FullFileMetadata[], filesOffset }
        }
        self.postMessage(response)
        break
      }

      case 'extractFile': {
        const result = await extractFile(request.data, request.path)
        const response: WorkerResponse = {
          type: 'extractFile',
          id: request.id,
          result
        }
        self.postMessage(response, { transfer: [result] })
        break
      }

      case 'extractFiles': {
        const result: Record<string, ArrayBuffer> = {}
        const transfers: ArrayBuffer[] = []
        for (const path of request.paths) {
          const buffer = await extractFile(request.data, path)
          result[path] = buffer
          transfers.push(buffer)
        }
        const response: WorkerResponse = {
          type: 'extractFiles',
          id: request.id,
          result
        }
        self.postMessage(response, { transfer: transfers })
        break
      }

      case 'modifyPackage': {
        const result = await modifyPackage(request.data, request.modifications)
        const response: WorkerResponse = {
          type: 'modifyPackage',
          id: request.id,
          result
        }
        self.postMessage(response, { transfer: [result.buffer] })
        break
      }
    }
  } catch (e) {
    const response: WorkerResponse = {
      type: 'error',
      id: request.id,
      error: e instanceof Error ? e.message : String(e)
    }
    self.postMessage(response)
  }
}
