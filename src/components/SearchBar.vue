<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

const model = defineModel<string>({ required: true })
const input = useTemplateRef<HTMLInputElement>('input')

// 「/」快速聚焦搜尋框
function onKey(e: KeyboardEvent) {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
  e.preventDefault()
  input.value?.focus()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function clear() {
  model.value = ''
  input.value?.focus()
}
</script>

<template>
  <div class="search" role="search">
    <svg class="icon" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="m13 13 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <label for="fish-search" class="visually-hidden">搜尋魚種</label>
    <input
      id="fish-search"
      ref="input"
      v-model="model"
      type="search"
      inputmode="search"
      autocomplete="off"
      spellcheck="false"
      placeholder="搜尋中文名、學名、俗名、英文名、科名…（空白分隔多個關鍵字）"
      @keydown.esc="model ? clear() : input?.blur()"
    />
    <button v-if="model" type="button" class="clear" aria-label="清除搜尋" @click="clear">×</button>
    <kbd v-else class="hint" aria-hidden="true">/</kbd>
  </div>
</template>

<style scoped>
.search {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: var(--text-faint);
  pointer-events: none;
}
input {
  width: 100%;
  min-height: 42px;
  padding: 8px 40px 8px 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  font-size: 15px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
input::placeholder {
  color: var(--text-faint);
  text-overflow: ellipsis;
}
input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
input::-webkit-search-cancel-button {
  display: none;
}
.clear {
  position: absolute;
  right: 6px;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
}
.clear:hover {
  background: var(--surface-2);
}
.hint {
  position: absolute;
  right: 10px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-faint);
  font-family: var(--mono);
  font-size: 12px;
}
@media (hover: none) {
  .hint {
    display: none;
  }
}
</style>
