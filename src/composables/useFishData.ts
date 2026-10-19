import { computed, readonly, ref, shallowRef } from 'vue'
import type { Fish, IndexedFish, Meta } from '../types'
import { indexFish } from './filterLogic'

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

/** 載入 fish.json（必要）與 meta.json（選用），並建立搜尋索引 */
export function useFishData() {
  // 資料量不大但不需深層響應：使用 shallowRef 避免 499 筆物件被 Proxy 包裝
  const items = shallowRef<IndexedFish[]>([])
  const meta = shallowRef<Meta | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const byId = computed(() => new Map(items.value.map((f) => [f.id, f])))

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [fishRes, metaRes] = await Promise.all([
        fetch(dataUrl('fish.json')),
        fetch(dataUrl('meta.json')).catch(() => null),
      ])
      if (!fishRes.ok) throw new Error(`HTTP ${fishRes.status} ${fishRes.statusText}`.trim())
      const raw: unknown = await fishRes.json()
      if (!Array.isArray(raw)) throw new Error('fish.json 格式不正確（應為陣列）')
      items.value = indexFish(raw as Fish[])
      if (metaRes?.ok) {
        try {
          meta.value = (await metaRes.json()) as Meta
        } catch {
          meta.value = null
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  return {
    items,
    meta,
    byId,
    loading: readonly(loading),
    error: readonly(error),
    load,
  }
}
