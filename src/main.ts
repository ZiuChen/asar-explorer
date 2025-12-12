import { createApp } from 'vue'
import { vaporInteropPlugin } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import i18n from './i18n'

// 注册 Service Worker
registerSW({
  onOfflineReady() {
    // 动态导入 toast 以避免循环依赖
    import('vue-sonner').then(({ toast }) => {
      const locale = navigator.language.startsWith('zh') ? 'zh' : 'en'
      toast.success(locale === 'zh' ? '应用已可离线使用' : 'App is ready to work offline', {
        description:
          locale === 'zh'
            ? '所有资源已缓存，您可以在没有网络的情况下使用此应用'
            : 'All resources have been cached, you can use this app without network'
      })
    })
  }
})

createApp(App).use(vaporInteropPlugin).use(i18n).mount('#app')
