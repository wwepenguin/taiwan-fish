# 臺灣經濟性魚種互動查詢

線上版：<https://wwepenguin.github.io/taiwan-fish/>

以中研院「臺灣魚類資料庫」經濟性魚種名錄（499 種）為資料來源的純靜態單頁查詢網站。
可依名稱即時搜尋，並以科、價格等級、產期、台灣分布、棲息環境、有毒/食用/觀賞、IUCN 狀態等條件交叉篩選；
提供卡片與表格兩種檢視、詳細資料面板，且所有查詢狀態都會同步到網址，方便分享。

## 功能

- **即時搜尋**：比對中文名、學名、俗名、英文俗名、科名、中國大陸名、同種異名；以空白分隔多個關鍵字（須全部符合）。按 `/` 可快速聚焦搜尋框。
- **分面篩選**：同一類條件為「或」、不同類條件為「且」；每個選項旁的筆數會依其他條件動態更新。產期選「春」時，「全年」產的魚種也會列入。
- **台灣分布地圖**：篩選面板的示意地圖（本島沿岸 8 區、澎湖／小琉球／綠島／蘭嶼，金門／東沙／南沙置於「非等比例」框內）可直接點選或以鍵盤 Enter／空白鍵切換分布篩選並顯示動態筆數，與清單、chips、網址 `region=` 同步；詳細面板以同一地圖標示該魚種的台灣分布。
- **排序**：中文名、學名、科名、價格（高→低／低→高）、最大體長、棲息深度；表格欄位標題可點擊排序。
- **詳細面板**：大圖（點擊開啟原圖）、基本資料、分布與棲地、形態特徵／棲所生態／地理分布／漁業利用、同種異名，以及舊站與新站連結。`Esc` 關閉，`←` `→` 切換上一筆／下一筆。
- **網址狀態**：`?q=&family=&price=&season=&region=&habitat=&iucn=&toxic=&edible=&ornamental=&view=&sort=&id=`，以 `history.replaceState` 更新，可直接複製分享。
- 繁體中文介面、深色模式（跟隨系統）、手機版（篩選面板改為抽屜、詳細面板全螢幕）。

## 資料來源與聲明

- 資料來源：[中研院臺灣魚類資料庫](https://fishdb.sinica.edu.tw/chi/fisheconomic.php)（經濟性魚種名錄）
- 資料維護：黃世彬（中研院生物多樣性研究中心）
- 網站營運：中研院數位文化中心

本站為非官方查詢介面，魚種資料與照片的著作權屬原資料庫及其提供者所有，照片直接連結自原站。
價格等級僅供參考，實際價格會因季節、漁獲量及地區不同而有所差異。

## 更新資料

資料由 `scripts/` 中的 Python 腳本（Python 3.12、僅用標準函式庫）抓取並產生，
輸出至 `public/data/fish.json` 與 `public/data/meta.json`。詳細說明見 [scripts/README.md](scripts/README.md)，簡要流程：

```sh
python3 -I scripts/scrape_list.py      # 名錄 → data/list.json
python3 -I scripts/scrape_details.py   # 逐筆詳細頁 → data/raw/species/<id>.html（可中斷續跑，約 25–30 分鐘）
python3 -I scripts/build_dataset.py    # 解析合併 → public/data/fish.json、meta.json
```

尚未抓取詳細頁的魚種會標記 `detail_fetched: false`，前端仍會顯示名錄欄位，並在詳細面板註明「詳細資料尚未載入」。
資料格式（`Fish` 介面）見 `src/types.ts` 與 `PLAN.md` 第 3 節。

## 開發

需要 Node.js 20 以上（已於 Node 24 測試）。

```sh
npm install
npm run dev        # 開發伺服器（http://localhost:5173）
npm run typecheck  # vue-tsc --noEmit
npm test           # Vitest：搜尋／篩選／分面計數／排序／網址狀態的單元測試
npm run build      # 型別檢查後輸出至 dist/
npm run preview    # 預覽 dist/
```

技術：Vite 6、Vue 3.5（Composition API、`<script setup lang="ts">`）、TypeScript；不使用 UI 框架、Pinia 或 Router。

```
src/
├── main.ts, App.vue, style.css
├── types.ts                       # Fish / Meta / 篩選狀態型別
├── composables/
│   ├── filterLogic.ts             # 純函式：搜尋索引、篩選、分面計數、排序、URL 序列化
│   ├── useFishData.ts             # 載入 fish.json / meta.json 並建立索引
│   ├── useFilters.ts              # 響應式篩選狀態、debounce 搜尋、URL 同步
│   └── __tests__/filterLogic.test.ts
└── components/                    # SearchBar, FilterPanel, FacetGroup, TriState, StatsBar,
                                   # FishCard, FishTable, FishDetail, FishImage, PriceStars, SiteFooter,
                                   # TaiwanMap（+ taiwanMapGeometry.ts 幾何資料與測試）
```

## 部署

`vite.config.ts` 設定 `base: './'`，`npm run build` 產出的 `dist/` 使用相對路徑，
可直接放到 GitHub Pages（含 `https://<user>.github.io/<repo>/` 子路徑）或任何靜態主機。
資料檔會從 `public/data/` 複製到 `dist/data/`，前端以 `${import.meta.env.BASE_URL}data/fish.json` 載入。
注意：直接以 `file://` 開啟 `dist/index.html` 時瀏覽器會阻擋 fetch，請透過 HTTP 伺服器（例如 `npm run preview`）瀏覽。
