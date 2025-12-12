<script setup lang="ts">
import { ref } from 'vue'
import { PackageOpen, Download, Loader2, Camera, X, RotateCcw } from 'lucide-vue-next'
import AsarFileTree from '@/components/asar-file-tree.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FileTreeNode } from '@/types/asar'
import { useAsarStore } from '@/stores/asar'

const {
  fileTree,
  currentFile,
  currentAsar,
  modifiedFiles,
  hasModifications,
  isRepacking,
  snapshots,
  openFile,
  resetAllFiles,
  downloadModifiedAsar,
  downloadOriginalAsar,
  createSnapshot,
  closeAsar
} = useAsarStore()

const snapshotName = ref('')
const showSnapshotInput = ref(false)

function handleFileSelect(node: FileTreeNode) {
  if (!node.isDirectory) {
    openFile(node.path)
  }
}

async function handleDownload() {
  try {
    await downloadModifiedAsar()
  } catch (e) {
    console.error('Download failed:', e)
  }
}

async function handleDownloadOriginal() {
  try {
    await downloadOriginalAsar()
  } catch (e) {
    console.error('Download original failed:', e)
  }
}

async function handleReset() {
  if (confirm('确定要清除所有修改吗？')) {
    try {
      await resetAllFiles()
    } catch (e) {
      console.error('Reset failed:', e)
    }
  }
}

async function handleCreateSnapshot() {
  if (!snapshotName.value.trim()) return

  try {
    await createSnapshot(snapshotName.value.trim())
    snapshotName.value = ''
    showSnapshotInput.value = false
  } catch (e) {
    console.error('Create snapshot failed:', e)
  }
}

function handleClose() {
  if (hasModifications.value) {
    if (!confirm('有未保存的修改，确定要关闭吗？')) {
      return
    }
  }
  closeAsar()
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 头部 -->
    <div class="p-4 border-b">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 min-w-0">
          <PackageOpen class="w-5 h-5 shrink-0" />
          <span class="font-semibold truncate">{{ currentAsar?.name }}</span>
        </div>
        <Button variant="ghost" size="icon" class="shrink-0" @click="handleClose">
          <X class="w-4 h-4" />
        </Button>
      </div>
    </div>

    <!-- 文件树 -->
    <div class="flex-1 overflow-auto p-2">
      <div class="mb-2">
        <div class="text-xs font-medium text-muted-foreground px-2 py-1">文件</div>
        <div class="space-y-0.5">
          <AsarFileTree
            v-for="node in fileTree"
            :key="node.path"
            :node="node"
            :selected-path="currentFile"
            :modified-files="modifiedFiles"
            @select="handleFileSelect"
          />
        </div>
      </div>

      <!-- 快照列表 -->
      <div v-if="snapshots.length > 0" class="mt-4">
        <div class="text-xs font-medium text-muted-foreground px-2 py-1">快照</div>
        <div class="px-2 space-y-1">
          <div
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="text-xs p-2 rounded bg-muted/50"
          >
            <p class="font-medium">{{ snapshot.name }}</p>
            <p class="text-muted-foreground">
              {{ new Date(snapshot.createdAt).toLocaleString() }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="p-4 border-t space-y-2">
      <div v-if="hasModifications" class="text-xs text-muted-foreground mb-2">
        已修改 {{ modifiedFiles.size }} 个文件
      </div>

      <!-- 创建快照 -->
      <div v-if="showSnapshotInput" class="flex gap-2">
        <Input
          v-model="snapshotName"
          placeholder="快照名称"
          class="flex-1"
          @keyup.enter="handleCreateSnapshot"
        />
        <Button size="icon" @click="handleCreateSnapshot" :disabled="!snapshotName.trim()">
          <Camera class="w-4 h-4" />
        </Button>
      </div>

      <Button
        v-if="hasModifications && !showSnapshotInput"
        variant="outline"
        class="w-full"
        @click="showSnapshotInput = true"
      >
        <Camera class="w-4 h-4 mr-2" />
        创建快照
      </Button>

      <Button class="w-full" :disabled="!hasModifications || isRepacking" @click="handleDownload">
        <Loader2 v-if="isRepacking" class="w-4 h-4 mr-2 animate-spin" />
        <Download v-else class="w-4 h-4 mr-2" />
        下载修改后的 ASAR
      </Button>

      <Button variant="outline" class="w-full" @click="handleDownloadOriginal">
        <Download class="w-4 h-4 mr-2" />
        下载原始 ASAR
      </Button>

      <Button v-if="hasModifications" variant="destructive" class="w-full" @click="handleReset">
        <RotateCcw class="w-4 h-4 mr-2" />
        清除所有修改
      </Button>
    </div>
  </div>
</template>
