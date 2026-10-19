<script setup lang="ts">
import { computed } from 'vue'
import type { Meta } from '../types'

const props = defineProps<{ meta: Meta | null; total: number; detailFetched: number }>()

const generated = computed(() => {
  const raw = props.meta?.generated_at
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
})
</script>

<template>
  <footer class="footer">
    <div class="inner">
      <p class="disclaimer">
        <strong>價格說明：</strong>價格等級僅供參考，實際價格會因季節、漁獲量及地區不同而有所差異。
      </p>
      <dl class="credits">
        <div>
          <dt>資料來源</dt>
          <dd>
            <a href="https://fishdb.sinica.edu.tw/chi/fisheconomic.php" target="_blank" rel="noopener noreferrer"
              >中研院臺灣魚類資料庫</a
            >（經濟性魚種名錄）
          </dd>
        </div>
        <div>
          <dt>資料維護</dt>
          <dd>黃世彬（中研院生物多樣性研究中心）</dd>
        </div>
        <div>
          <dt>網站營運</dt>
          <dd>中研院數位文化中心</dd>
        </div>
        <div>
          <dt>資料抓取</dt>
          <dd>
            <template v-if="generated"><time :datetime="meta?.generated_at">{{ generated }}</time></template>
            <template v-else>—</template>
            ・共 {{ total }} 種，詳細資料已載入 {{ detailFetched }} 種
          </dd>
        </div>
      </dl>
      <p class="small">
        本站為非官方的查詢介面，所有魚種資料與照片之著作權屬原資料庫及其提供者所有；照片直接連結自原站。如需引用請以原資料庫為準。
      </p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  margin-top: 40px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
}
.inner {
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 16px 32px;
}
.disclaimer {
  margin: 0 0 16px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--warn-soft);
  color: var(--text);
}
.credits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px 24px;
  margin: 0;
}
.credits div {
  display: flex;
  gap: 8px;
}
dt {
  flex: none;
  color: var(--text-faint);
}
dd {
  margin: 0;
  color: var(--text);
}
.small {
  margin: 16px 0 0;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
