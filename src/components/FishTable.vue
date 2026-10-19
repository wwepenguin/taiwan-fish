<script setup lang="ts">
import type { Fish, SortDir, SortField } from '../types'
import FishImage from './FishImage.vue'
import PriceStars from './PriceStars.vue'

defineProps<{ items: Fish[]; sort: SortField; dir: SortDir; activeId: string | null }>()
const emit = defineEmits<{ select: [id: string]; sort: [field: SortField] }>()

interface Col {
  key: string
  label: string
  sort?: SortField
  cls?: string
}

const cols: Col[] = [
  { key: 'photo', label: '照片', cls: 'c-photo' },
  { key: 'name', label: '中文名', sort: 'name' },
  { key: 'scientific', label: '學名', sort: 'scientific' },
  { key: 'family', label: '科', sort: 'family' },
  { key: 'price', label: '價格', sort: 'price' },
  { key: 'common', label: '俗名', cls: 'c-wide' },
  { key: 'season', label: '產期', cls: 'c-wide' },
  { key: 'length', label: '最大體長', sort: 'length', cls: 'c-num' },
  { key: 'depth', label: '深度', sort: 'depth', cls: 'c-num' },
]

function ariaSort(c: Col, sort: SortField, dir: SortDir) {
  if (!c.sort || c.sort !== sort) return undefined
  return dir === 'asc' ? 'ascending' : 'descending'
}

function depth(f: Fish) {
  if (f.depth_min != null && f.depth_max != null) return `${f.depth_min}–${f.depth_max} m`
  if (f.depth_text) return f.depth_text
  return '—'
}

function length(f: Fish) {
  if (f.max_length_cm != null) return `${f.max_length_cm} cm`
  return f.max_length_text ?? '—'
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="c in cols" :key="c.key" :class="c.cls" scope="col" :aria-sort="ariaSort(c, sort, dir)">
            <button v-if="c.sort" type="button" class="th-btn" @click="emit('sort', c.sort)">
              {{ c.label }}
              <span class="arrow" aria-hidden="true">{{
                c.sort === sort ? (dir === 'asc' ? '▲' : '▼') : '↕'
              }}</span>
            </button>
            <template v-else>{{ c.label }}</template>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="f in items"
          :key="f.id"
          :class="{ active: f.id === activeId }"
          @click="emit('select', f.id)"
        >
          <td class="c-photo">
            <span class="mini"><FishImage :src="f.photo_thumb" :alt="f.name_zh" /></span>
          </td>
          <td class="c-name">
            <button type="button" class="name-btn" @click.stop="emit('select', f.id)">{{ f.name_zh }}</button>
          </td>
          <td><i>{{ f.scientific }}</i></td>
          <td class="nowrap">{{ f.family_zh }}</td>
          <td class="nowrap"><PriceStars :price="f.price" /></td>
          <td class="c-wide muted">{{ f.common_names.slice(0, 3).join('、') }}<template v-if="f.common_names.length > 3">…</template></td>
          <td class="c-wide muted">{{ f.season }}</td>
          <td class="c-num">{{ length(f) }}</td>
          <td class="c-num">{{ depth(f) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}
th,
td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  vertical-align: middle;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}
.th-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-weight: inherit;
}
.th-btn:hover {
  color: var(--text);
}
.arrow {
  font-size: 10px;
  opacity: 0.6;
}
[aria-sort] .arrow {
  color: var(--accent);
  opacity: 1;
}
tbody tr {
  cursor: pointer;
}
tbody tr:hover {
  background: var(--surface-2);
}
tbody tr.active {
  background: var(--accent-soft);
}
tbody tr:last-child td {
  border-bottom: 0;
}
.c-photo {
  width: 64px;
  padding: 4px 6px 4px 10px;
}
.mini {
  display: block;
  width: 56px;
  height: 32px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface-2);
}
.name-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}
.name-btn:hover {
  color: var(--accent);
  text-decoration: underline;
}
.nowrap {
  white-space: nowrap;
}
.muted {
  color: var(--text-muted);
}
.c-wide {
  min-width: 140px;
  max-width: 240px;
}
.c-num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
th.c-num {
  text-align: right;
}
</style>
