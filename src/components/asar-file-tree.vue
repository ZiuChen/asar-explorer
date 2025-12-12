<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight, File, Folder, FolderOpen, FileCode, FilePen } from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { FileTreeNode } from '@/types/asar'

defineOptions({
  name: 'AsarFileTree'
})

const props = defineProps<{
  node: FileTreeNode
  selectedPath?: string | null
  modifiedFiles?: Set<string>
}>()

const emit = defineEmits<{
  select: [node: FileTreeNode]
}>()

// 目录展开状态
const isOpen = ref(false)

// 可编辑文件的扩展名
const EDITABLE_EXTENSIONS = [
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.jsx',
  '.tsx',
  '.json',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.md',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
  '.env',
  '.gitignore',
  '.sh',
  '.bash',
  '.py',
  '.sql'
]

function handleSelect() {
  if (!props.node.isDirectory) {
    emit('select', props.node)
  }
}

function isSelected(node: FileTreeNode): boolean {
  return node.path === props.selectedPath
}

function isModified(node: FileTreeNode): boolean {
  // 检查 node 自身的 modified 属性或 modifiedFiles 集合
  return node.modified || (props.modifiedFiles?.has(node.path) ?? false)
}

function getFileIcon(node: FileTreeNode) {
  if (node.isDirectory) return Folder
  if (isFileEditable(node.name)) return FileCode
  return File
}

// 检查文件是否可编辑
function isFileEditable(filename: string): boolean {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  return EDITABLE_EXTENSIONS.includes(ext)
}
</script>

<template>
  <!-- 文件节点 -->
  <div
    v-if="!node.isDirectory"
    :class="[
      'flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-accent transition-colors',
      isSelected(node) ? 'bg-accent text-accent-foreground' : ''
    ]"
    @click="handleSelect"
  >
    <component :is="getFileIcon(node)" class="size-4 shrink-0" />
    <span
      class="truncate flex-1"
      :class="{
        'text-orange-500': isModified(node)
      }"
      >{{ node.name }}</span
    >
    <FilePen v-if="isModified(node)" class="w-3 h-3 text-yellow-500 shrink-0" />
  </div>

  <!-- 目录节点 -->
  <div v-else>
    <Collapsible
      v-model:open="isOpen"
      class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
    >
      <CollapsibleTrigger as-child>
        <button
          :class="[
            'flex items-center gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-accent transition-colors w-full text-left'
          ]"
        >
          <ChevronRight class="size-4 transition-transform shrink-0" />
          <FolderOpen v-if="isOpen" class="size-4 shrink-0" />
          <Folder v-else class="size-4 shrink-0" />
          <span class="truncate">{{ node.name }}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="pl-4 border-l border-border/50 ml-2">
          <AsarFileTree
            v-for="child in node.children"
            :key="child.path"
            :node="child"
            :selected-path="selectedPath"
            :modified-files="modifiedFiles"
            @select="emit('select', $event)"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
