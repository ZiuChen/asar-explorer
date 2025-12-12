import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

// 获取浏览器语言
function getBrowserLanguage(): string {
  const lang = navigator.language || (navigator as any).userLanguage
  // 如果是中文（包括 zh-CN, zh-TW, zh-HK 等），返回 zh
  if (lang.startsWith('zh')) {
    return 'zh'
  }
  return 'en'
}

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getBrowserLanguage(),
  fallbackLocale: 'en',
  messages: {
    zh,
    en
  }
})

export default i18n
