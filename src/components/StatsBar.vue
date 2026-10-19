<script setup lang="ts">
import { computed } from 'vue'
import { PRICE_VALUES } from '../composables/filterLogic'

const props = defineProps<{
  matched: number
  total: number
  /** 目前結果中各價格等級筆數（'1'..'5' 與 'none'） */
  priceCounts: Map<string, number>
  selectedPrices: string[]
}>()

const emit = defineEmits<{ togglePrice: [value: string] }>()

const bars = computed(() => {
  const max = Math.max(1, ...PRICE_VALUES.map((v) => props.priceCounts.get(v) ?? 0))
  return PRICE_VALUES.map((v) => {
    const count = props.priceCounts.get(v) ?? 0
    return {
      value: v,
      count,
      pct: (count / max) * 100,
      label: v === 'none' ? '未標示' : `★${v}`,
      aria: v === 'none' ? `價格未標示：${count} 筆` : `價格等級 ${v}：${count} 筆`,
      pressed: props.selectedPrices.includes(v),
    }
  })
})
</script>

<template>
  <section class="stats" aria-label="統計">
    <p class="count" aria-live="polite">
      <strong>{{ matched.toLocaleString() }}</strong>
      <span class="sep">/</span>
      <span>{{ total.toLocaleString() }} 種</span>
    </p>
    <div class="dist" role="group" aria-label="價格分布（點擊可篩選）">
      <span class="dist-label">價格分布</span>
      <button
        v-for="b in bars"
        :key="b.value"
        type="button"
        :class="['bar', { pressed: b.pressed, none: b.value === 'none' }]"
        :aria-pressed="b.pressed"
        :aria-label="b.aria"
        :title="b.aria"
        @click="emit('togglePrice', b.value)"
      >
        <span class="n">{{ b.count }}</span>
        <span class="track"><span class="fill" :style="{ height: `${b.pct}%` }" /></span>
        <span class="lbl">{{ b.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.stats {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.count {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.count strong {
  color: var(--text);
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
}
.sep {
  margin: 0 4px;
  color: var(--text-faint);
}
.dist {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}
.dist-label {
  align-self: center;
  margin-right: 6px;
  color: var(--text-faint);
  font-size: 12px;
  writing-mode: horizontal-tb;
}
.bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 40px;
  padding: 2px 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: none;
}
.bar:hover {
  background: var(--surface-2);
}
.bar.pressed {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.n {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.track {
  display: flex;
  align-items: flex-end;
  width: 18px;
  height: 34px;
  border-radius: 3px 3px 0 0;
  background: var(--surface-3);
  overflow: hidden;
}
.fill {
  display: block;
  width: 100%;
  min-height: 0;
  background: var(--star);
  transition: height 0.25s ease;
}
.none .fill {
  background: var(--text-faint);
}
.lbl {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}
@media (max-width: 480px) {
  .dist-label {
    display: none;
  }
  .bar {
    width: 34px;
  }
}
</style>
