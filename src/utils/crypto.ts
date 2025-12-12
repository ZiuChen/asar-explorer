import { SHA256 } from 'crypto-js'
import { nanoid } from 'nanoid'

export function prefixedNanoid(prefix: string = '', size: number = 21): string {
  return `${prefix}_${nanoid(size)}`
}

export async function sha256(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && 'subtle' in crypto) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // @ts-expect-error - Fallback to crypto-js
  const wordArray = SHA256(new Uint8Array(data))
  return wordArray.toString()
}
