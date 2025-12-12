<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Upload, Link, Loader2, History, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAsarStore } from '@/stores/asar'

const {
  loadFromFile,
  loadFromUrl,
  loadFromHistory,
  deleteFromHistory,
  asarHistory,
  loadHistory,
  isLoadingAsar,
  error
} = useAsarStore()

const urlInput = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const showHistory = ref(false)

// 加载历史记录
onMounted(() => {
  loadHistory()
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
    await loadFromFile(file)
  } catch (e) {
    console.error('Failed to load file:', e)
  } finally {
    input.value = ''
  }
}

// 处理 URL 加载
async function handleUrlLoad() {
  if (!urlInput.value.trim()) return

  try {
    await loadFromUrl(urlInput.value.trim())
    urlInput.value = ''
  } catch (e) {
    console.error('Failed to load from URL:', e)
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

// 从历史记录加载
async function handleLoadFromHistory(id: string) {
  try {
    await loadFromHistory(id)
  } catch (e) {
    console.error('Failed to load from history:', e)
  }
}

// 从历史记录删除
async function handleDeleteFromHistory(id: string, event: Event) {
  event.stopPropagation()
  if (confirm('确定要删除这条历史记录吗？')) {
    await deleteFromHistory(id)
  }
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 格式化日期
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-center min-h-[400px] p-8 space-y-8 w-full max-w-2xl"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <!-- 标题 -->
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-bold">ASAR Explorer</h1>
      <p class="text-muted-foreground">在线预览和编辑 Electron ASAR 文件</p>
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
        <p class="text-lg font-medium">点击或拖放 ASAR 文件</p>
        <p class="text-sm text-muted-foreground mt-1">支持 .asar 格式文件</p>
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
        <span class="text-sm text-muted-foreground">或</span>
        <div class="flex-1 h-px bg-border" />
      </div>

      <!-- URL 输入 -->
      <div class="flex gap-2">
        <Input
          v-model="urlInput"
          placeholder="输入 ASAR 文件 URL..."
          class="flex-1"
          @keyup.enter="handleUrlLoad"
        />
        <Button @click="handleUrlLoad" :disabled="!urlInput.trim()">
          <Link class="w-4 h-4 mr-2" />
          加载
        </Button>
      </div>

      <!-- 历史记录 -->
      <div v-if="asarHistory.length > 0" class="mt-6">
        <button
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
          @click="showHistory = !showHistory"
        >
          <History class="w-4 h-4" />
          <span>历史记录 ({{ asarHistory.length }})</span>
        </button>

        <div v-if="showHistory" class="mt-4 space-y-2 max-h-60 overflow-y-auto">
          <div
            v-for="item in asarHistory"
            :key="item.id"
            class="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
            @click="handleLoadFromHistory(item.id)"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ item.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ formatSize(item.size) }} · {{ formatDate(item.lastModifiedAt) }}
                <span v-if="item.modifiedFileCount > 0" class="ml-2 text-orange-500">
                  {{ item.modifiedFileCount }} 处修改
                </span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="shrink-0 ml-2"
              @click="handleDeleteFromHistory(item.id, $event)"
            >
              <Trash2 class="w-4 h-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-if="isLoadingAsar" class="flex items-center gap-2">
      <Loader2 class="w-5 h-5 animate-spin" />
      <span>正在加载 ASAR 文件...</span>
    </div>
  </div>
</template>
