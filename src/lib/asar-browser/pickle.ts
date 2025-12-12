/**
 * Pickle - Binary value packing and unpacking
 * 基于 https://github.com/electron/asar 的 Pickle 实现
 * 移除了 Buffer 依赖，使用原生 ArrayBuffer/DataView
 */

// sizeof(T)
export const SIZE_INT32 = 4
export const SIZE_UINT32 = 4
export const SIZE_FLOAT = 4
export const SIZE_DOUBLE = 8

// The allocation granularity of the payload
export const PAYLOAD_UNIT = 64

// Largest JS number
export const CAPACITY_READ_ONLY = 9007199254740992

// Aligns 'i' by rounding it up to the next multiple of 'alignment'
export const alignInt = (i: number, alignment: number): number =>
  i + ((alignment - (i % alignment)) % alignment)

/**
 * PickleIterator reads data from a Pickle
 */
class PickleIterator {
  private payload: Uint8Array
  private dataView: DataView
  private payloadOffset: number
  private readIndex: number
  private endIndex: number

  constructor(pickle: Pickle) {
    this.payload = pickle.header
    this.dataView = new DataView(
      pickle.header.buffer,
      pickle.header.byteOffset,
      pickle.header.byteLength
    )
    this.payloadOffset = pickle.headerSize
    this.readIndex = 0
    this.endIndex = pickle.getPayloadSize()
  }

  readBool(): boolean {
    return this.readInt() !== 0
  }

  readInt(): number {
    return this.readBytesAsNumber(SIZE_INT32, true)
  }

  readUInt32(): number {
    return this.readBytesAsNumber(SIZE_UINT32, false)
  }

  readFloat(): number {
    const offset = this.getReadPayloadOffsetAndAdvance(SIZE_FLOAT)
    return this.dataView.getFloat32(offset, true)
  }

  readDouble(): number {
    const offset = this.getReadPayloadOffsetAndAdvance(SIZE_DOUBLE)
    return this.dataView.getFloat64(offset, true)
  }

  readString(): string {
    const length = this.readInt()
    const bytes = this.readBytes(length)
    return new TextDecoder('utf-8').decode(bytes)
  }

  readBytes(length: number): Uint8Array {
    const readPayloadOffset = this.getReadPayloadOffsetAndAdvance(length)
    return this.payload.slice(readPayloadOffset, readPayloadOffset + length)
  }

  private readBytesAsNumber(size: number, signed: boolean): number {
    const offset = this.getReadPayloadOffsetAndAdvance(size)
    if (size === SIZE_INT32) {
      return signed ? this.dataView.getInt32(offset, true) : this.dataView.getUint32(offset, true)
    }
    throw new Error(`Unsupported size: ${size}`)
  }

  private getReadPayloadOffsetAndAdvance(length: number): number {
    if (length > this.endIndex - this.readIndex) {
      this.readIndex = this.endIndex
      throw new Error('Failed to read data with length of ' + length)
    }
    const readPayloadOffset = this.payloadOffset + this.readIndex
    this.advance(length)
    return readPayloadOffset
  }

  private advance(size: number): void {
    const alignedSize = alignInt(size, SIZE_UINT32)
    if (this.endIndex - this.readIndex < alignedSize) {
      this.readIndex = this.endIndex
    } else {
      this.readIndex += alignedSize
    }
  }
}

/**
 * Pickle class provides facilities for basic binary value packing and unpacking
 */
export default class Pickle {
  header: Uint8Array
  headerSize: number
  private dataView: DataView
  private capacityAfterHeader: number
  private writeOffset: number

  constructor(buffer?: Uint8Array) {
    if (buffer) {
      this.header = buffer
      this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      this.headerSize = buffer.length - this.getPayloadSize()
      this.capacityAfterHeader = CAPACITY_READ_ONLY
      this.writeOffset = 0
      if (this.headerSize > buffer.length) {
        this.headerSize = 0
      }
      if (this.headerSize !== alignInt(this.headerSize, SIZE_UINT32)) {
        this.headerSize = 0
      }
      if (this.headerSize === 0) {
        this.header = new Uint8Array(0)
        this.dataView = new DataView(this.header.buffer)
      }
    } else {
      this.header = new Uint8Array(0)
      this.dataView = new DataView(this.header.buffer)
      this.headerSize = SIZE_UINT32
      this.capacityAfterHeader = 0
      this.writeOffset = 0
      this.resize(PAYLOAD_UNIT)
      this.setPayloadSize(0)
    }
  }

  createIterator(): PickleIterator {
    return new PickleIterator(this)
  }

  toBuffer(): Uint8Array {
    return this.header.slice(0, this.headerSize + this.getPayloadSize())
  }

  writeBool(value: boolean): boolean {
    return this.writeInt(value ? 1 : 0)
  }

  writeInt(value: number): boolean {
    return this.writeNumber(value, SIZE_INT32, true)
  }

  writeUInt32(value: number): boolean {
    return this.writeNumber(value, SIZE_UINT32, false)
  }

  writeFloat(value: number): boolean {
    const dataLength = alignInt(SIZE_FLOAT, SIZE_UINT32)
    const newSize = this.writeOffset + dataLength
    if (newSize > this.capacityAfterHeader) {
      this.resize(Math.max(this.capacityAfterHeader * 2, newSize))
    }
    this.dataView.setFloat32(this.headerSize + this.writeOffset, value, true)
    this.fillZeros(SIZE_FLOAT, dataLength)
    this.setPayloadSize(newSize)
    this.writeOffset = newSize
    return true
  }

  writeDouble(value: number): boolean {
    const dataLength = alignInt(SIZE_DOUBLE, SIZE_UINT32)
    const newSize = this.writeOffset + dataLength
    if (newSize > this.capacityAfterHeader) {
      this.resize(Math.max(this.capacityAfterHeader * 2, newSize))
    }
    this.dataView.setFloat64(this.headerSize + this.writeOffset, value, true)
    this.fillZeros(SIZE_DOUBLE, dataLength)
    this.setPayloadSize(newSize)
    this.writeOffset = newSize
    return true
  }

  writeString(value: string): boolean {
    const encoded = new TextEncoder().encode(value)
    const length = encoded.length
    if (!this.writeInt(length)) {
      return false
    }
    return this.writeBytes(encoded, length)
  }

  setPayloadSize(payloadSize: number): void {
    this.dataView.setUint32(0, payloadSize, true)
  }

  getPayloadSize(): number {
    if (this.header.length < 4) return 0
    return this.dataView.getUint32(0, true)
  }

  private writeNumber(value: number, size: number, signed: boolean): boolean {
    const dataLength = alignInt(size, SIZE_UINT32)
    const newSize = this.writeOffset + dataLength
    if (newSize > this.capacityAfterHeader) {
      this.resize(Math.max(this.capacityAfterHeader * 2, newSize))
    }
    if (signed) {
      this.dataView.setInt32(this.headerSize + this.writeOffset, value, true)
    } else {
      this.dataView.setUint32(this.headerSize + this.writeOffset, value, true)
    }
    this.fillZeros(size, dataLength)
    this.setPayloadSize(newSize)
    this.writeOffset = newSize
    return true
  }

  private writeBytes(data: Uint8Array, length: number): boolean {
    const dataLength = alignInt(length, SIZE_UINT32)
    const newSize = this.writeOffset + dataLength
    if (newSize > this.capacityAfterHeader) {
      this.resize(Math.max(this.capacityAfterHeader * 2, newSize))
    }
    this.header.set(data, this.headerSize + this.writeOffset)
    this.fillZeros(length, dataLength)
    this.setPayloadSize(newSize)
    this.writeOffset = newSize
    return true
  }

  private fillZeros(start: number, end: number): void {
    const endOffset = this.headerSize + this.writeOffset + start
    for (let i = endOffset; i < this.headerSize + this.writeOffset + end; i++) {
      this.header[i] = 0
    }
  }

  private resize(newCapacity: number): void {
    newCapacity = alignInt(newCapacity, PAYLOAD_UNIT)
    const newHeader = new Uint8Array(this.headerSize + newCapacity)
    newHeader.set(this.header)
    this.header = newHeader
    this.dataView = new DataView(newHeader.buffer, newHeader.byteOffset, newHeader.byteLength)
    this.capacityAfterHeader = newCapacity
  }
}

export const createEmpty = (): Pickle => new Pickle()

export const createFromBuffer = (buffer: Uint8Array): Pickle => new Pickle(buffer)
