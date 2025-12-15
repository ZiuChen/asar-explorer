<script setup lang="ts">
import { Upload, Link, Loader2, Github } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAsarStore } from '@/stores/asar'
import { toast } from 'vue-sonner'
import { useEventListener } from '@vueuse/core'

const { t } = useI18n()

const { loadFromFile, loadFromUrl, isLoadingAsar, error } = useAsarStore()

const urlInput = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

useEventListener('paste', (e) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file && file.name.endsWith('.asar')) {
        e.preventDefault()
        loadFromFile(file).catch((err) => {
          console.error('Failed to load pasted file:', err)
        })
        return
      }
    } else if (item.kind === 'string' && item.type === 'text/plain') {
      item.getAsString(async (text) => {
        if (text.startsWith('http://') || text.startsWith('https://')) {
          e.preventDefault()
          try {
            await loadFromUrl(text)
          } catch (err) {
            console.error('Failed to load from pasted URL:', err)
          }
        }
      })
    }
  }
})

// 处理文件选择
function handleFileSelect() {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    toast.info(t('uploader.loadingAsar'))
    await loadFromFile(file)
    toast.success(t('uploader.loadSuccess'))
  } catch (e) {
    console.error('Failed to load file:', e)
    toast.error(t('uploader.loadFailed'), {
      description: e instanceof Error ? e.message : String(e)
    })
  } finally {
    input.value = ''
  }
}

// 处理 URL 加载
async function handleUrlLoad() {
  if (!urlInput.value.trim()) return

  try {
    toast.info(t('uploader.loadingAsar'))
    await loadFromUrl(urlInput.value.trim())
    toast.success(t('uploader.loadSuccess'))
    urlInput.value = ''
  } catch (e) {
    console.error('Failed to load from URL:', e)
    toast.error(t('uploader.loadFailed'), {
      description: e instanceof Error ? e.message : String(e)
    })
  }
}

// 处理文件拖放
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'copy'
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (!file || !file.name.endsWith('.asar')) return

  try {
    await loadFromFile(file)
  } catch (e) {
    console.error('Failed to load dropped file:', e)
  }
}
</script>

<template>
  <div
    class="relative flex flex-col items-center justify-center min-h-[400px] p-8 space-y-8 w-full max-w-2xl"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- GitHub 链接 -->
    <a
      href="https://github.com/ZiuChen/asar-explorer"
      target="_blank"
      rel="noopener noreferrer"
      class="absolute top-0 right-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
      title="GitHub"
    >
      <Github class="size-5" />
    </a>

    <!-- 标题 -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">{{ t('app.title') }}</h1>
      <p class="text-muted-foreground">{{ t('app.description') }}</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="text-destructive text-center max-w-md">
      {{ error }}
    </div>

    <!-- 上传区域 -->
    <div v-if="!isLoadingAsar" class="w-full space-y-4">
      <!-- 文件上传 -->
      <div
        class="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
        @click="handleFileSelect"
      >
        <Upload class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p class="text-lg font-medium">{{ t('uploader.dropOrClick') }}</p>
        <p class="text-sm text-muted-foreground mt-1">{{ t('uploader.supportFormat') }}</p>
        <input
          ref="fileInputRef"
          type="file"
          accept=".asar"
          class="hidden"
          @change="onFileChange"
        />
      </div>

      <!-- 分隔线 -->
      <div class="flex items-center gap-4">
        <div class="flex-1 h-px bg-border" />
        <span class="text-sm text-muted-foreground">{{ t('common.or') }}</span>
        <div class="flex-1 h-px bg-border" />
      </div>

      <!-- URL 输入 -->
      <div class="flex gap-2">
        <Input
          v-model="urlInput"
          :placeholder="t('uploader.inputUrlPlaceholder')"
          class="flex-1"
          @keyup.enter="handleUrlLoad"
        />
        <Button @click="handleUrlLoad" :disabled="!urlInput.trim()">
          <Link class="size-4" />
          {{ t('common.load') }}
        </Button>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="isLoadingAsar" class="flex items-center gap-2">
      <Loader2 class="w-5 h-5 animate-spin" />
      <span>{{ t('uploader.loadingAsar') }}</span>
    </div>
  </div>
</template>
