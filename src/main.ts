import { createApp } from 'vue'
import { vaporInteropPlugin } from 'vue'
import './style.css'
import App from './App.vue'
import i18n from './i18n'

createApp(App).use(vaporInteropPlugin).use(i18n).mount('#app')
