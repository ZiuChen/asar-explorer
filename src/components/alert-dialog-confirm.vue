<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

const { t } = useI18n()

interface Props {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default'
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const open = ref(false)

// 用于外部调用的 Promise 解析函数
let resolvePromise: ((value: boolean) => void) | null = null

// 打开对话框并返回 Promise
function show(): Promise<boolean> {
  open.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

function handleConfirm() {
  open.value = false
  emit('confirm')
  resolvePromise?.(true)
  resolvePromise = null
}

function handleCancel() {
  open.value = false
  emit('cancel')
  resolvePromise?.(false)
  resolvePromise = null
}

defineExpose({
  show
})
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ cancelText || t('common.cancel') }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="variant === 'destructive' ? 'bg-destructive hover:bg-destructive/90' : ''"
          @click="handleConfirm"
        >
          {{ confirmText || t('common.confirm') }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
