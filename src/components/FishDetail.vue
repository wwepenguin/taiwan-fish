<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from 'vue'
import type { Fish } from '../types'
import FishImage from './FishImage.vue'
import PriceStars from './PriceStars.vue'
import TaiwanMap from './TaiwanMap.vue'
import { TAIWAN_REGION_NAMES } from './taiwanMapGeometry'

const props = defineProps<{
  fish: Fish | null
  /** 在目前結果中的位置（1 起算）；不在結果中時為 null */
  position: number | null
  total: number
  hasPrev: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{ close: []; prev: []; next: [] }>()

const panel = useTemplateRef<HTMLElement>('panel')
const body = useTemplateRef<HTMLElement>('body')
const closeBtn = useTemplateRef<HTMLButtonElement>('closeBtn')
let lastFocus: HTMLElement | null = null

const yesNo = (v: boolean | null) => (v == null ? null : v ? '是' : '否')

interface Row {
  label: string
  value: string
  italic?: boolean
  /** 在此列旁顯示台灣分布地圖 */
  map?: boolean
}

/** 唯讀地圖：列出全部分區（筆數 0），只標示該魚種的分布 */
const ALL_REGIONS = TAIWAN_REGION_NAMES.map((name) => ({ name, count: 0 }))

const basicRows = computed<Row[]>(() => {
  const f = props.fish
  if (!f) return []
  const rows: (Row | null)[] = [
    { label: '中文名', value: f.name_zh },
    { label: '學名', value: f.scientific, italic: true },
    f.author ? { label: '命名者', value: f.author } : null,
    { label: '科', value: [f.family_zh, f.family_latin].filter(Boolean).join(' ') + `（${f.family_id}）` },
    f.name_cn ? { label: '中國大陸名', value: f.name_cn } : null,
    f.common_names.length ? { label: '俗名', value: f.common_names.join('、') } : null,
    f.english_names.length ? { label: '英文俗名', value: f.english_names.join('; ') } : null,
    f.season ? { label: '產期', value: f.season } : null,
    f.max_length_text || f.max_length_cm != null
      ? { label: '最大體長', value: f.max_length_text ?? `${f.max_length_cm} cm` }
      : null,
    f.depth_text || f.depth_min != null || f.depth_max != null
      ? {
          label: '棲息深度',
          value: f.depth_text ?? `${f.depth_min ?? '?'} – ${f.depth_max ?? '?'} 公尺`,
        }
      : null,
    f.iucn_code || f.iucn_text
      ? { label: 'IUCN 狀態', value: [f.iucn_code, f.iucn_text].filter(Boolean).join('・') }
      : null,
    f.type_locality ? { label: '模式種產地', value: f.type_locality } : null,
  ]
  return rows.filter((r): r is Row => r !== null)
})

const flags = computed(() => {
  const f = props.fish
  if (!f) return []
  return (
    [
      { label: '食用', value: yesNo(f.edible), warn: false },
      { label: '有毒', value: yesNo(f.toxic), warn: f.toxic === true },
      { label: '觀賞', value: yesNo(f.ornamental), warn: false },
      { label: '經濟性', value: yesNo(f.economic), warn: false },
    ] as const
  ).filter((x) => x.value !== null)
})

const distRows = computed<Row[]>(() => {
  const f = props.fish
  if (!f) return []
  const rows: (Row | null)[] = [
    f.distribution_taiwan || f.taiwan_regions.length
      ? {
          label: '台灣分布',
          value: f.distribution_taiwan ?? f.taiwan_regions.join('、'),
          map: f.taiwan_regions.length > 0,
        }
      : null,
    f.distribution_world ? { label: '世界分布', value: f.distribution_world } : null,
    f.habitat || f.habitat_tags.length
      ? { label: '棲息環境', value: f.habitat ?? f.habitat_tags.join('、') }
      : null,
  ]
  return rows.filter((r): r is Row => r !== null)
})

const longTexts = computed(() => {
  const f = props.fish
  if (!f) return []
  return [
    { label: '形態特徵', text: f.morphology },
    { label: '棲所生態', text: f.ecology },
    { label: '地理分布', text: f.distribution_desc },
    { label: '漁業利用', text: f.fishery_use },
  ].filter((x): x is { label: string; text: string } => !!x.text)
})

const largeSrc = computed(() => props.fish?.photo_large ?? props.fish?.photo_thumb ?? null)

// ---- 鍵盤：Esc 關閉、←/→ 上下一筆、Tab 焦點限制在面板內
function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

function onKey(e: KeyboardEvent) {
  if (!props.fish) return
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowLeft' && !isTyping(e.target) && props.hasPrev) {
    emit('prev')
  } else if (e.key === 'ArrowRight' && !isTyping(e.target) && props.hasNext) {
    emit('next')
  } else if (e.key === 'Tab' && panel.value) {
    const nodes = panel.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    )
    if (!nodes.length) return
    const first = nodes[0]!
    const last = nodes[nodes.length - 1]!
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    } else if (!panel.value.contains(document.activeElement)) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.fish?.id ?? null,
  async (id, oldId) => {
    if (id && !oldId) {
      lastFocus = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', onKey)
      document.body.classList.add('scroll-locked')
      await nextTick()
      closeBtn.value?.focus({ preventScroll: true })
    } else if (!id && oldId) {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('scroll-locked')
      lastFocus?.focus?.({ preventScroll: true })
      lastFocus = null
    }
    if (id) {
      await nextTick()
      body.value?.scrollTo({ top: 0 })
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('scroll-locked')
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="fish" class="overlay" aria-hidden="true" @click="emit('close')" />
    </Transition>
    <Transition name="slide">
      <aside
        v-if="fish"
        ref="panel"
        class="drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="`${fish.name_zh} 詳細資料`"
        tabindex="-1"
      >
        <header class="bar">
          <div class="nav">
            <button type="button" class="btn btn-icon" :disabled="!hasPrev" aria-label="上一筆" title="上一筆（←）" @click="emit('prev')">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <button type="button" class="btn btn-icon" :disabled="!hasNext" aria-label="下一筆" title="下一筆（→）" @click="emit('next')">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <span v-if="position" class="pos">{{ position }} / {{ total }}</span>
            <span v-else class="pos">不在目前篩選結果中</span>
          </div>
          <button ref="closeBtn" type="button" class="btn btn-icon" aria-label="關閉" title="關閉（Esc）" @click="emit('close')">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
          </button>
        </header>

        <div ref="body" class="content">
          <div class="title">
            <h2>{{ fish.name_zh }}</h2>
            <p class="sci-line">
              <i>{{ fish.scientific }}</i>
              <span v-if="fish.author" class="author">{{ fish.author }}</span>
            </p>
            <p class="sub">
              <span class="family">{{ fish.family_zh }}<template v-if="fish.family_latin"> · {{ fish.family_latin }}</template></span>
              <PriceStars :price="fish.price" />
            </p>
          </div>

          <component
            :is="largeSrc ? 'a' : 'div'"
            class="hero"
            v-bind="largeSrc ? { href: largeSrc, target: '_blank', rel: 'noopener noreferrer', title: '在新分頁開啟原圖' } : {}"
          >
            <FishImage :key="fish.id" :src="largeSrc" :alt="fish.name_zh" eager />
            <span v-if="largeSrc" class="open-hint" aria-hidden="true">開啟原圖 ↗</span>
          </component>

          <p v-if="!fish.detail_fetched" class="pending">
            詳細資料尚未載入，目前僅顯示名錄欄位。完整資料請見下方原站連結。
          </p>

          <ul v-if="flags.length" class="flags" aria-label="用途與特性">
            <li v-for="x in flags" :key="x.label" :class="{ yes: x.value === '是', warn: x.warn }">
              {{ x.label }}：{{ x.value }}
            </li>
          </ul>

          <section class="section">
            <h3>基本資料</h3>
            <dl class="grid">
              <div v-for="r in basicRows" :key="r.label">
                <dt>{{ r.label }}</dt>
                <dd :class="{ sci: r.italic }">{{ r.value }}</dd>
              </div>
              <div>
                <dt>價格等級</dt>
                <dd><PriceStars :price="fish.price" /></dd>
              </div>
            </dl>
          </section>

          <section v-if="distRows.length" class="section">
            <h3>分布與棲地</h3>
            <dl class="grid one">
              <div v-for="r in distRows" :key="r.label">
                <dt>{{ r.label }}</dt>
                <dd v-if="r.map" class="with-map">
                  <span class="row-text">{{ r.value }}</span>
                  <TaiwanMap
                    class="detail-map"
                    mode="readonly"
                    :regions="ALL_REGIONS"
                    :highlight="fish.taiwan_regions"
                  />
                </dd>
                <dd v-else>{{ r.value }}</dd>
              </div>
            </dl>
          </section>

          <details v-for="t in longTexts" :key="t.label" class="long" open>
            <summary>{{ t.label }}</summary>
            <p>{{ t.text }}</p>
          </details>

          <details v-if="fish.synonyms.length" class="long" open>
            <summary>同種異名（{{ fish.synonyms.length }}）</summary>
            <ul class="syn">
              <li v-for="s in fish.synonyms" :key="s"><i>{{ s }}</i></li>
            </ul>
          </details>

          <details v-if="fish.references" class="long">
            <summary>參考文獻</summary>
            <p class="refs">{{ fish.references }}</p>
          </details>

          <div class="links">
            <a class="btn" :href="fish.source_url" target="_blank" rel="noopener noreferrer">舊站物種頁 ↗</a>
            <a class="btn" :href="fish.new_site_url" target="_blank" rel="noopener noreferrer">新站物種頁 ↗</a>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: var(--overlay);
}
.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 41;
  display: flex;
  flex-direction: column;
  width: min(620px, 100vw);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  outline: none;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.nav {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pos {
  margin-left: 4px;
  color: var(--text-muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.content {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px 20px 32px;
}
.title h2 {
  margin: 0;
  font-size: 24px;
  line-height: 1.3;
}
.sci-line {
  margin: 2px 0 0;
  font-size: 16px;
}
.author {
  margin-left: 6px;
  color: var(--text-muted);
  font-size: 14px;
}
.sub {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 0;
  color: var(--text-muted);
  font-size: 14px;
}
.family {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
}
.hero {
  position: relative;
  display: block;
  margin: 16px 0;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
}
.open-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s;
}
.hero:hover .open-hint,
.hero:focus-visible .open-hint {
  opacity: 1;
}
@media (hover: none) {
  .open-hint {
    opacity: 1;
  }
}
.pending {
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 13px;
}
.flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}
.flags li {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 13px;
}
.flags li.yes {
  background: var(--ok-soft);
  color: var(--ok);
}
.flags li.warn {
  background: var(--danger-soft);
  color: var(--danger);
  font-weight: 600;
}
.section {
  margin-bottom: 18px;
}
h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--border);
}
.grid.one {
  grid-template-columns: minmax(0, 1fr);
}
.grid > div {
  padding: 7px 10px;
  background: var(--surface);
}
.grid > div:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
dt {
  color: var(--text-faint);
  font-size: 12px;
}
dd {
  margin: 0;
  font-size: 14px;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.with-map {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.row-text {
  flex: 1;
  min-width: 0;
}
.detail-map {
  flex: none;
  width: 250px;
}
.long {
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.long summary {
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 650;
  cursor: pointer;
  user-select: none;
}
.long[open] summary {
  border-bottom: 1px solid var(--border);
}
.long p {
  margin: 0;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.refs {
  color: var(--text-muted);
  font-size: 13px !important;
}
.syn {
  margin: 0;
  padding: 10px 12px 10px 30px;
  font-size: 14px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.links .btn {
  text-decoration: none;
}

@media (max-width: 640px) {
  .drawer {
    width: 100vw;
  }
  .content {
    padding: 14px 16px 28px;
  }
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .with-map {
    flex-direction: column;
    align-items: stretch;
  }
  .detail-map {
    width: 100%;
    max-width: 300px;
    margin: 4px auto 0;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.22s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.22s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
