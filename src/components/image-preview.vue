<script setup lang="ts">
/**
 * 图像预览组件
 * 用于预览 ASAR 中的图像文件
 */
import { ref, watch, onBeforeUnmount } from 'vue'
import { useAsarStore } from '@/stores/asar'

const { currentFile, getFileSystem } = useAsarStore()

const imageUrl = ref<string | null>(null)
const error = ref<string | null>(null)
const loading = ref(false)

// 获取文件的 MIME 类型
function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || ''
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    bmp: 'image/bmp'
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

// 加载图像
async function loadImage(path: string) {
  loading.value = true
  error.value = null

  // 清理旧的 URL
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = null
  }

  try {
    const fs = getFileSystem()
    const normalizedPath = path.replace(/^\/+/, '')
    const content = await fs.readFile(normalizedPath)
    const mimeType = getMimeType(path)
    const blob = new Blob([content.buffer as ArrayBuffer], { type: mimeType })
    imageUrl.value = URL.createObjectURL(blob)
  } catch (e) {
    console.error('Failed to load image:', e)
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// 监听文件变化
watch(
  currentFile,
  (newPath) => {
    if (newPath) {
      loadImage(newPath)
    }
  },
  { immediate: true }
)

// 清理 URL
onBeforeUnmount(() => {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
  }
})
</script>

<template>
  <div class="w-full h-full flex items-center justify-center bg-background/50 p-4 overflow-auto">
    <!-- 加载中 -->
    <div v-if="loading" class="text-muted-foreground">加载中...</div>

    <!-- 错误 -->
    <div v-else-if="error" class="text-destructive text-center">
      <p>无法加载图像</p>
      <p class="text-sm mt-1">{{ error }}</p>
    </div>

    <!-- 图像 -->
    <img
      v-else-if="imageUrl"
      :src="imageUrl"
      :alt="currentFile || ''"
      class="max-w-full max-h-full object-contain shadow-lg rounded"
    />
  </div>
</template>
