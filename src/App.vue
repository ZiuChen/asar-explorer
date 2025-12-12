<script setup lang="ts">
import { defineAsyncComponent, computed, ref } from 'vue'
import { Download, Wand2, Loader2, Undo2, PackageSearch } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import * as prettier from 'prettier/standalone'
import prettierPluginBabel from 'prettier/plugins/babel'
import prettierPluginEstree from 'prettier/plugins/estree'
import prettierPluginHtml from 'prettier/plugins/html'
import prettierPluginCss from 'prettier/plugins/postcss'
import prettierPluginMarkdown from 'prettier/plugins/markdown'
import prettierPluginYaml from 'prettier/plugins/yaml'
import prettierPluginGraphql from 'prettier/plugins/graphql'
import prettierPluginTypescript from 'prettier/plugins/typescript'
import AsarUploader from '@/components/asar-uploader.vue'
import MonacoEditor from '@/components/monaco-editor.vue'
import ImagePreview from '@/components/image-preview.vue'
import AlertDialogConfirm from '@/components/alert-dialog-confirm.vue'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { useAsarStore } from '@/stores/asar'
import { Toaster } from './components/ui/sonner'
import { toast } from 'vue-sonner'
import 'vue-sonner/style.css'

const { t } = useI18n()

const AsarSidebar = defineAsyncComponent(() => import('@/components/asar-sidebar.vue'))

const { asarLoaded, currentFile, modifiedFiles, resetFile, getFileSystem } = useAsarStore()

const monacoEditorRef = ref<InstanceType<typeof MonacoEditor> | null>(null)
const isFormatting = ref(false)
const revertDialogRef = ref<InstanceType<typeof AlertDialogConfirm> | null>(null)

// 当前文件是否已修改
const isCurrentFileModified = computed(() => {
  if (!currentFile.value) return false
  const normalizedPath = currentFile.value.replace(/^\/+/, '')
  return modifiedFiles.value.has(normalizedPath)
})

// 撤销当前文件修改
async function revertCurrentFile() {
  if (!currentFile.value) return
  const confirmed = await revertDialogRef.value?.show()
  if (confirmed) {
    try {
      await resetFile(currentFile.value)
      toast.success(t('app.revertSuccess'))
    } catch (e) {
      console.error('Revert failed:', e)
      toast.error(t('app.revertFailed'), {
        description: e instanceof Error ? e.message : String(e)
      })
    }
  }
}

// 图像文件扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp']

// 判断当前文件是否为图像
const isImageFile = computed(() => {
  if (!currentFile.value) return false
  const ext = currentFile.value.toLowerCase().split('.').pop()
  return ext ? IMAGE_EXTENSIONS.includes('.' + ext) : false
})

// 根据文件扩展名获取 Prettier parser
function getPrettierParser(path: string): string | null {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const parserMap: Record<string, string> = {
    js: 'babel',
    jsx: 'babel',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    vue: 'html',
    svelte: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    markdown: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    graphql: 'graphql',
    gql: 'graphql'
  }
  return parserMap[ext] || null
}

// 判断当前文件是否支持格式化
const canFormat = computed(() => {
  if (!currentFile.value || isImageFile.value) return false
  return getPrettierParser(currentFile.value) !== null
})

// 格式化当前文件
async function formatCurrentFile() {
  if (!currentFile.value || !monacoEditorRef.value) return

  const parser = getPrettierParser(currentFile.value)
  if (!parser) {
    toast.error(t('app.formatUnsupported'))
    return
  }

  const model = monacoEditorRef.value.getModel()
  if (!model) return

  try {
    isFormatting.value = true
    const code = model.getValue()

    const formatted = await prettier.format(code, {
      parser,
      plugins: [
        prettierPluginBabel,
        prettierPluginEstree,
        prettierPluginHtml,
        prettierPluginCss,
        prettierPluginMarkdown,
        prettierPluginYaml,
        prettierPluginGraphql,
        prettierPluginTypescript
      ],
      tabWidth: 2,
      useTabs: false,
      semi: false,
      singleQuote: true,
      trailingComma: 'none',
      printWidth: 100
    })

    // 更新编辑器内容
    model.setValue(formatted)
    toast.success(t('app.formatSuccess'))
  } catch (e) {
    console.error('Format failed:', e)
    toast.error(t('app.formatFailed'), {
      description: e instanceof Error ? e.message : String(e)
    })
  } finally {
    isFormatting.value = false
  }
}

// 下载当前文件
async function downloadCurrentFile() {
  if (!currentFile.value) return

  try {
    const fs = getFileSystem()
    const normalizedPath = currentFile.value.replace(/^\/+/, '')
    const content = await fs.readFile(normalizedPath)
    const fileName = currentFile.value.split('/').pop() || 'file'

    const blob = new Blob([content.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(t('app.downloadSuccess'))
  } catch (e) {
    console.error('Failed to download file:', e)
    toast.error(t('app.downloadFailed'), {
      description: e instanceof Error ? e.message : String(e)
    })
  }
}
</script>

<template>
  <Toaster />
  <!-- 未加载 ASAR -->
  <div v-if="!asarLoaded" class="min-h-screen flex items-center justify-center bg-background">
    <AsarUploader />
  </div>

  <!-- 已加载 ASAR - 使用 Resizable 布局 -->
  <ResizablePanelGroup v-else direction="horizontal" class="h-screen">
    <!-- Sidebar 面板 -->
    <ResizablePanel :default-size="20" :min-size="20" :max-size="50" class="bg-sidebar">
      <AsarSidebar />
    </ResizablePanel>

    <!-- 拖拽手柄 -->
    <ResizableHandle with-handle />

    <!-- 主内容面板 -->
    <ResizablePanel :default-size="80" class="flex flex-col h-screen">
      <!-- 顶部栏 -->
      <header class="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span v-if="currentFile" class="text-sm font-medium ml-2 truncate" :title="currentFile">
            {{ currentFile }}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <!-- 撤销修改按钮 -->
          <Button
            v-if="isCurrentFileModified"
            variant="ghost"
            size="icon"
            @click="revertCurrentFile"
            :title="t('app.revertFile')"
            class="text-orange-500 hover:text-orange-600"
          >
            <Undo2 class="size-4" />
          </Button>
          <!-- 格式化按钮 -->
          <Button
            v-if="canFormat"
            variant="ghost"
            size="icon"
            :disabled="isFormatting"
            @click="formatCurrentFile"
            :title="t('app.formatFile')"
          >
            <Loader2 v-if="isFormatting" class="size-4 animate-spin" />
            <Wand2 v-else class="size-4" />
          </Button>
          <!-- 下载按钮 -->
          <Button
            v-if="currentFile"
            variant="ghost"
            size="icon"
            @click="downloadCurrentFile"
            :title="t('app.downloadFile')"
          >
            <Download class="size-4" />
          </Button>
        </div>
      </header>

      <!-- 主内容区 - 根据文件类型显示不同内容 -->
      <main class="flex-1 min-h-0 relative">
        <!-- 未选择文件时的占位提示 -->
        <div
          v-if="!currentFile"
          class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"
        >
          <PackageSearch class="size-16 mb-4 opacity-50" />
          <p class="text-lg font-medium">{{ t('app.noFileSelected') }}</p>
          <p class="text-sm mt-1">{{ t('app.selectFileHint') }}</p>
        </div>
        <!-- 图像预览 -->
        <ImagePreview v-show="currentFile && isImageFile" class="absolute inset-0" />
        <!-- Monaco Editor 组件 -->
        <MonacoEditor
          ref="monacoEditorRef"
          v-show="currentFile && !isImageFile"
          class="absolute inset-0"
        />
      </main>

      <!-- 撤销文件修改确认对话框 -->
      <AlertDialogConfirm
        ref="revertDialogRef"
        :title="t('app.revertConfirmTitle')"
        :description="t('app.revertConfirmDescription')"
        variant="destructive"
      />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
