<script setup lang="ts">
import { computed, ref, useId } from 'vue'

export interface FacetItem {
  value: string
  label: string
  /** 額外的搜尋字串（例如科的拉丁名） */
  keywords?: string
  title?: string
}

const props = withDefaults(
  defineProps<{
    title: string
    options: FacetItem[]
    selected: string[]
    counts: Map<string, number>
    searchable?: boolean
    /** 收合時顯示的選項數；0 表示全部顯示 */
    limit?: number
    /** 是否以 chip 方式橫向排列 */
    inline?: boolean
    /** 依目前（動態）筆數排序：已選取者優先，其次筆數多者；同筆數維持原順序（總筆數序） */
    sortByCount?: boolean
  }>(),
  { searchable: false, limit: 0, inline: false, sortByCount: false },
)

const emit = defineEmits<{ toggle: [value: string]; clear: [] }>()

defineSlots<{ label?(props: { option: FacetItem }): unknown }>()

const search = ref('')
const expanded = ref(false)

const selectedSet = computed(() => new Set(props.selected))

const ordered = computed(() => {
  if (!props.sortByCount) return props.options
  const sel = selectedSet.value
  return props.options
    .map((o, i) => ({ o, i, c: props.counts.get(o.value) ?? 0, s: sel.has(o.value) ? 1 : 0 }))
    .sort((a, b) => b.s - a.s || b.c - a.c || a.i - b.i)
    .map((x) => x.o)
})

const matched = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return ordered.value
  return ordered.value.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q))
})

const visible = computed(() => {
  const list = matched.value
  if (!props.limit || expanded.value || search.value.trim() || list.length <= props.limit) return list
  const head = list.slice(0, props.limit)
  const extra = list.slice(props.limit).filter((o) => selectedSet.value.has(o.value))
  return [...head, ...extra]
})

const hiddenCount = computed(() => matched.value.length - visible.value.length)
const id = useId()
</script>

<template>
  <section class="facet" :aria-labelledby="`${id}-h`">
    <header>
      <h3 :id="`${id}-h`">
        {{ title }}
        <span v-if="selected.length" class="badge">{{ selected.length }}</span>
      </h3>
      <button v-if="selected.length" type="button" class="link" @click="emit('clear')">清除</button>
    </header>

    <div v-if="searchable" class="facet-search">
      <input
        v-model="search"
        type="search"
        :placeholder="`篩選${title}…`"
        :aria-label="`篩選${title}選項`"
        autocomplete="off"
      />
    </div>

    <ul :class="['opts', { inline, scroll: searchable }]">
      <li v-for="o in visible" :key="o.value">
        <label
          :class="{
            checked: selectedSet.has(o.value),
            zero: !counts.get(o.value) && !selectedSet.has(o.value),
          }"
          :title="o.title"
        >
          <input
            type="checkbox"
            :checked="selectedSet.has(o.value)"
            @change="emit('toggle', o.value)"
          />
          <span class="text">
            <slot name="label" :option="o">{{ o.label }}</slot>
          </span>
          <span class="count">{{ counts.get(o.value) ?? 0 }}</span>
        </label>
      </li>
      <li v-if="!visible.length" class="empty">沒有符合的選項</li>
    </ul>

    <button
      v-if="hiddenCount > 0 || (expanded && limit && !search)"
      type="button"
      class="link more"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收合' : `顯示全部（另 ${hiddenCount} 項）` }}
    </button>
  </section>
</template>

<style scoped>
.facet {
  padding: 14px 0;
  border-top: 1px solid var(--border);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.badge {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 13px;
}
.link:hover {
  text-decoration: underline;
}
.more {
  margin-top: 6px;
}
.facet-search input {
  width: 100%;
  min-height: 32px;
  margin-bottom: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: 13px;
}
.facet-search input:focus {
  outline: none;
  border-color: var(--accent);
}
.opts {
  margin: 0;
  padding: 0;
  list-style: none;
}
.opts.scroll {
  max-height: 260px;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-right: -6px;
  padding-right: 6px;
}
.opts.inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}
label:hover {
  background: var(--surface-2);
}
label.zero {
  color: var(--text-faint);
}
input[type='checkbox'] {
  flex: none;
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--accent);
}
.text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  color: var(--text-faint);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
/* chip 樣式 */
.inline label {
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 13px;
}
.inline label.checked {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--text);
}
.inline input[type='checkbox'] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.inline label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.inline .text {
  flex: none;
}
.empty {
  padding: 4px 6px;
  color: var(--text-faint);
  font-size: 13px;
}
</style>
