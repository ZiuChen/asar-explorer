<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import AsarUploader from '@/components/asar-uploader.vue'
import MonacoEditor from '@/components/monaco-editor.vue'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useAsarStore } from '@/stores/asar'

const AsarSidebar = defineAsyncComponent(() => import('@/components/asar-sidebar.vue'))

const { asarLoaded, currentFile } = useAsarStore()
</script>

<template>
  <!-- 未加载 ASAR -->
  <div v-if="!asarLoaded" class="min-h-screen flex items-center justify-center bg-background">
    <AsarUploader />
  </div>

  <!-- 已加载 ASAR - 使用 Resizable 布局 -->
  <ResizablePanelGroup v-else direction="horizontal" class="h-screen">
    <!-- Sidebar 面板 -->
    <ResizablePanel :default-size="25" :min-size="25" :max-size="50" class="bg-sidebar">
      <AsarSidebar />
    </ResizablePanel>

    <!-- 拖拽手柄 -->
    <ResizableHandle with-handle />

    <!-- 主内容面板 -->
    <ResizablePanel :default-size="80" class="flex flex-col h-screen">
      <!-- 顶部栏 -->
      <header class="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <span class="text-sm text-muted-foreground">ASAR Explorer</span>
        <span v-if="currentFile" class="text-sm font-medium ml-2">{{ currentFile }}</span>
      </header>

      <!-- 主内容区 - Monaco 编辑器 -->
      <main class="flex-1 min-h-0 relative">
        <!-- Monaco Editor 组件 -->
        <MonacoEditor class="absolute inset-0" />
      </main>
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

/* Monaco Editor 样式 */
monaco-editor {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
