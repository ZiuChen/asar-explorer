<script setup lang="ts">
import { ref } from 'vue'
import { PackageOpen, Download, Loader2, X, RotateCcw } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import AsarFileTree from '@/components/asar-file-tree.vue'
import AlertDialogConfirm from '@/components/alert-dialog-confirm.vue'
import { Button } from '@/components/ui/button'
import type { FileTreeNode } from '@/types/asar'
import { useAsarStore } from '@/stores/asar'

const { t } = useI18n()

const {
  fileTree,
  currentFile,
  currentAsar,
  modifiedFiles,
  hasModifications,
  isRepacking,
  openFile,
  resetAllFiles,
  downloadModifiedAsar,
  downloadOriginalAsar,
  closeAsar
} = useAsarStore()

const clearDialogRef = ref<InstanceType<typeof AlertDialogConfirm> | null>(null)
const closeDialogRef = ref<InstanceType<typeof AlertDialogConfirm> | null>(null)

function handleFileSelect(node: FileTreeNode) {
  if (!node.isDirectory) {
    openFile(node.path)
  }
}

async function handleDownload() {
  if (hasModifications.value) {
    try {
      await downloadModifiedAsar()
    } catch (e) {
      console.error('Download failed:', e)
    }
  } else {
    try {
      await downloadOriginalAsar()
    } catch (e) {
      console.error('Download original failed:', e)
    }
  }
}

async function handleReset() {
  const confirmed = await clearDialogRef.value?.show()
  if (confirmed) {
    try {
      await resetAllFiles()
    } catch (e) {
      console.error('Reset failed:', e)
    }
  }
}

async function handleClose() {
  if (hasModifications.value) {
    const confirmed = await closeDialogRef.value?.show()
    if (!confirmed) {
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
          <X class="size-4" />
        </Button>
      </div>
    </div>

    <!-- 文件树 -->
    <div class="flex-1 overflow-auto p-2">
      <div class="mb-2">
        <div class="text-xs font-medium text-muted-foreground px-2 py-1">
          {{ t('common.files') }}
        </div>
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
    </div>

    <!-- 底部操作栏 -->
    <div class="p-4 border-t space-y-2">
      <div v-if="hasModifications" class="text-xs text-muted-foreground mb-2">
        {{ t('sidebar.modified', { count: modifiedFiles.size }) }}
      </div>

      <Button class="w-full" :disabled="isRepacking" @click="handleDownload">
        <Loader2 v-if="isRepacking" class="size-4 animate-spin" />
        <Download v-else class="size-4" />
        {{ t('common.download') }}
      </Button>

      <Button v-if="hasModifications" variant="destructive" class="w-full" @click="handleReset">
        <RotateCcw class="size-4" />
        {{ t('sidebar.clearModifications') }}
      </Button>
    </div>

    <!-- 清除修改确认对话框 -->
    <AlertDialogConfirm
      ref="clearDialogRef"
      :title="t('sidebar.clearConfirmTitle')"
      :description="t('sidebar.clearConfirmDescription')"
      variant="destructive"
    />

    <!-- 关闭确认对话框 -->
    <AlertDialogConfirm
      ref="closeDialogRef"
      :title="t('sidebar.closeConfirmTitle')"
      :description="t('sidebar.closeConfirmDescription')"
    />
  </div>
</template>
