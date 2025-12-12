<script setup lang="ts">
/**
 * Monaco Editor 组件
 * 使用 modern-monaco 作为编辑器，不使用 Workspace
 */
import { onMounted, onBeforeUnmount, ref, watch, shallowRef } from 'vue'
import { init } from 'modern-monaco'
import { Loader2 } from 'lucide-vue-next'
import { useAsarStore } from '@/stores/asar'

const containerRef = ref<HTMLElement | null>(null)
const isLoading = ref(true)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editor = shallowRef<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const currentModel = shallowRef<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let monaco: any = null

const { getFileSystem, currentFile, refreshFileTree, error } = useAsarStore()

// 根据文件扩展名获取语言
function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    vue: 'html',
    svelte: 'html',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql'
  }
  return languageMap[ext] || 'plaintext'
}

// 监听 currentFile 变化，加载文件内容到编辑器
watch(currentFile, async (newPath) => {
  if (!editor.value || !newPath) return

  try {
    const fs = getFileSystem()
    const normalizedPath = newPath.replace(/^\/+/, '')
    const content = await fs.readFile(normalizedPath)

    if (!content) {
      console.error('File not found:', normalizedPath)
      return
    }

    // 解码文件内容
    const text = new TextDecoder().decode(content)
    const language = getLanguageFromPath(newPath)

    // 创建新的 model 或更新现有的
    if (currentModel.value) {
      currentModel.value.dispose()
    }

    const uri = monaco.Uri.parse(`file:///${normalizedPath}`)
    const existingModel = monaco.editor.getModel(uri)
    if (existingModel) {
      existingModel.setValue(text)
      currentModel.value = existingModel
    } else {
      currentModel.value = monaco.editor.createModel(text, language, uri)
    }

    editor.value.setModel(currentModel.value)
  } catch (e) {
    console.error('Failed to open file:', e)
    error.value = e instanceof Error ? e.message : String(e)
  }
})

onMounted(async () => {
  if (!containerRef.value) return

  try {
    // 初始化 modern-monaco
    monaco = await init({ theme: 'nord' })

    // 创建编辑器实例
    editor.value = monaco.editor.create(containerRef.value, {
      theme: 'nord',
      automaticLayout: true,
      minimap: { enabled: true },
      fontSize: 14,
      lineNumbers: 'on',
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      tabSize: 2,
      insertSpaces: true,
      renderWhitespace: 'selection',
      'bracketPairColorization.enabled': true
    })

    // 监听内容变化，保存到文件系统
    editor.value.onDidChangeModelContent(async () => {
      if (!currentFile.value || !currentModel.value) return

      const fs = getFileSystem()
      const content = currentModel.value.getValue()
      const normalizedPath = currentFile.value.replace(/^\/+/, '')

      try {
        await fs.writeFile(normalizedPath, content)
        refreshFileTree()
      } catch (e) {
        console.error('Failed to save file:', e)
      }
    })

    isLoading.value = false
    console.log('Monaco editor initialized')
  } catch (e) {
    console.error('Failed to initialize editor:', e)
    error.value = e instanceof Error ? e.message : String(e)
    isLoading.value = false
  }
})

onBeforeUnmount(() => {
  if (currentModel.value) {
    currentModel.value.dispose()
    currentModel.value = null
  }
  if (editor.value) {
    editor.value.dispose()
    editor.value = null
  }
})

// 暴露编辑器实例和 model，供外部调用（如格式化）
defineExpose({
  getEditor: () => editor.value,
  getModel: () => currentModel.value
})
</script>

<template>
  <div class="monaco-container relative w-full h-full">
    <!-- Loading 占位 -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-background z-10"
    >
      <div class="flex items-center gap-2 text-muted-foreground">
        <Loader2 class="w-5 h-5 animate-spin" />
        <span>Loading editor...</span>
      </div>
    </div>

    <!-- Monaco Editor 容器 -->
    <div ref="containerRef" class="w-full h-full" />
  </div>
</template>

<style scoped>
.monaco-container {
  width: 100%;
  height: 100%;
}
</style>
