import { createVaporApp } from 'vue'
import { vaporInteropPlugin } from 'vue'
import './style.css'
import App from './App.vue'

createVaporApp(App).use(vaporInteropPlugin).mount('#app')
