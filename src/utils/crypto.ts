import { SHA256 } from 'crypto-js'

export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  // Fallback for environments without crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
