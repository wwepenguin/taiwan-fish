<script setup lang="ts">
import type { Tri } from '../types'

defineProps<{ label: string; name: string; counts: { yes: number; no: number } }>()
const model = defineModel<Tri>({ required: true })

const choices: { value: Tri; text: string }[] = [
  { value: 'any', text: '不限' },
  { value: 'yes', text: '是' },
  { value: 'no', text: '否' },
]
</script>

<template>
  <fieldset class="tri">
    <legend>{{ label }}</legend>
    <div class="seg">
      <label v-for="c in choices" :key="c.value" :class="{ checked: model === c.value }">
        <input v-model="model" type="radio" :name="name" :value="c.value" class="visually-hidden" />
        <span>{{ c.text }}</span>
        <small v-if="c.value !== 'any'">{{ counts[c.value] }}</small>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.tri {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  float: left;
  padding: 0;
  font-size: 14px;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
label {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  padding: 3px 10px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}
label + label {
  border-left: 1px solid var(--border);
}
label:hover {
  background: var(--surface-2);
}
label.checked {
  background: var(--accent);
  color: var(--accent-contrast);
}
label:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
small {
  font-size: 11px;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
</style>
