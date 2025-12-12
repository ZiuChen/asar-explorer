<script setup lang="ts">
/**
 * Monaco Editor 组件
 * 封装 modern-monaco 的初始化和渲染
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Workspace, lazy } from 'modern-monaco'
import { useAsarStore } from '@/stores/asar'

const containerRef = ref<HTMLElement | null>(null)
const { getFileSystem, setWorkspace, setEditorReady, error } = useAsarStore()

let workspace: Workspace | null = null

onMounted(async () => {
  if (!containerRef.value) return

  try {
    const asarFS = getFileSystem()

    // 创建 Workspace，使用自定义文件系统
    workspace = new Workspace({
      name: 'asar-explorer',
      customFS: asarFS
    })

    // 初始化 lazy 模式的 Monaco
    await lazy({
      workspace,
      theme: 'nord'
    })

    // 通知 store 编辑器已就绪
    setWorkspace(workspace)
    setEditorReady(true)
    console.log('Monaco editor initialized')
  } catch (e) {
    console.error('Failed to initialize editor:', e)
    error.value = e instanceof Error ? e.message : String(e)
  }
})

onBeforeUnmount(() => {
  if (workspace) {
    // 清理 workspace
    workspace = null
    setWorkspace(null)
    setEditorReady(false)
  }
})
</script>

<template>
  <div ref="containerRef" class="monaco-container">
    <monaco-editor class="w-full h-full" />
  </div>
</template>

<style scoped>
.monaco-container {
  width: 100%;
  height: 100%;
}

.monaco-container :deep(monaco-editor) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
