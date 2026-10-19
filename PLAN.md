# 臺灣經濟性魚種互動查詢網頁 — 規劃書

資料來源：中研院「臺灣魚類資料庫」經濟性魚種名錄
<https://fishdb.sinica.edu.tw/chi/fisheconomic.php>（499 種，舊站已停止更新；新站 `https://fishdb.sinica.edu.tw/taxon/<id>-fishdb`）

## 1. 目標

做一個純靜態、可直接部署（GitHub Pages / 任何靜態主機）的單頁查詢網站：
- 關鍵字即時搜尋（中文名、學名、俗名、英文俗名、科名、大陸名、同種異名）
- 多維度篩選（科、價格等級、產期季節、台灣分布區域、棲息環境、有毒/食用/觀賞、IUCN 狀態）
- 排序、卡片/表格雙檢視、詳細資料面板、分享用 URL 狀態
- 繁體中文介面、手機可用、深色模式

## 2. 來源網站結構（已勘查）

### 名錄頁 `fisheconomic.php?page=1&pz=500`
一次可取回全部 499 列。每列 `<tr><td class=tdN>…` 依序為：
1. 科中文名 → `family.php?id=F###`
2. 學名（`<i>`）→ `species.php?id=######`
3. 中文名
4. 俗名（超過三個會以 `...` 截斷，完整版在詳細頁）
5. 產期（自由文字，可為空）
6. 價格 `/images/price{1..5}.gif`（可為空；分布 1:43 2:66 3:127 4:120 5:28，約 115 筆無價格）
7. 照片縮圖（多數在 `/chi/spe_picture/dpi100/`，少數在 `ecopic/medium`、`images/ASIZP|FRIP|NMNS|NTOU`）

圖片可直接外連（HTTP 200，無 Referer 限制）。

### 物種詳細頁 `species.php?id=<id>`
表格 `td.tdspt`（欄位名）/ `td.tdspc`（值）成對出現。欄位：
學名、命名者、棲息深度（`1 - 50` 公尺）、中文名、有毒魚類、科中文名、經濟性、科號科名（`F370 Lutjanidae`）、食用魚類、中國大陸名、最大體長（`100 cm`）、觀賞魚類、其他中文名（完整俗名）、世界分布、台灣分布、棲息環境、模式種產地、同種異名、參考文獻、典藏標本、英文俗名、瀕危狀態（圖 alt=IUCN 代碼）、形態特徵、棲所生態、地理分布、漁業利用。
大圖：`./spe_picture/dpi300/<file>.jpg`。

robots.txt：`/chi/` 未禁止，`Crawl-delay: 10`（Drupal 樣板）。本專案採單一連線、每請求間隔 3 秒、自訂 User-Agent，並快取原始 HTML 以便重跑不再打站。

## 3. 資料模型 `public/data/fish.json`

陣列，每筆物件（詳細頁欄位在尚未抓取時為 `null`/`[]`）：

```ts
interface Fish {
  id: string;                 // "382143"
  family_id: string;          // "F370"
  family_zh: string;          // "笛鯛科"
  family_latin: string|null;  // "Lutjanidae"
  scientific: string;         // "Symphorus nematophorus"
  author: string|null;        // "(Bleeker, 1860)"
  name_zh: string;            // "曳絲笛鯛"
  name_cn: string|null;       // 中國大陸名
  common_names: string[];     // 俗名，以「、」切分；優先用詳細頁完整版
  english_names: string[];    // 以「;」切分
  synonyms: string[];         // 以「,」切分
  season: string;             // 產期原文，可為 ""
  season_tags: string[];      // 由產期推導：["春","夏","秋","冬"] 子集合，或 ["全年"]；無法判斷為 []
  price: 1|2|3|4|5|null;
  photo_thumb: string|null;   // 絕對 URL（名錄頁縮圖）
  photo_large: string|null;   // 絕對 URL（詳細頁 dpi300）
  depth_min: number|null; depth_max: number|null; depth_text: string|null;
  max_length_cm: number|null; max_length_text: string|null;
  toxic: boolean|null; edible: boolean|null; ornamental: boolean|null; economic: boolean|null;
  distribution_world: string|null;
  distribution_taiwan: string|null;
  taiwan_regions: string[];   // 由台灣分布以「、」切分
  habitat: string|null;
  habitat_tags: string[];     // 由棲息環境以「、」切分
  type_locality: string|null;
  iucn_code: string|null;     // "NL" 等（圖片 alt）
  iucn_text: string|null;     // "不在IUCN瀕危名單中"
  morphology: string|null;    // 形態特徵
  ecology: string|null;       // 棲所生態
  distribution_desc: string|null; // 地理分布
  fishery_use: string|null;   // 漁業利用
  references: string|null;
  source_url: string;         // https://fishdb.sinica.edu.tw/chi/species.php?id=<id>
  new_site_url: string;       // https://fishdb.sinica.edu.tw/taxon/<id>-fishdb
  detail_fetched: boolean;
}
```

另輸出 `public/data/meta.json`：`{ generated_at, total, detail_fetched, source }`。

## 4. 專案結構

```
taiwan-fish/
├── PLAN.md
├── scripts/                    # Python 3.12 標準函式庫，不需第三方套件
│   ├── scrape_list.py          # 名錄 → data/list.json
│   ├── scrape_details.py       # 逐筆詳細頁 → data/raw/species/<id>.html（可中斷續跑）
│   └── build_dataset.py        # 解析合併 → public/data/fish.json + meta.json
├── data/                       # 中間產物（list.json、raw/ HTML 快取）
├── public/data/fish.json       # 前端載入的資料
├── src/                        # Vite + Vue 3 + TypeScript（Composition API, <script setup>）
│   ├── main.ts / App.vue
│   ├── types.ts                # 上述 Fish 介面
│   ├── composables/useFishData.ts   # fetch + 索引
│   ├── composables/useFilters.ts    # 搜尋/篩選/排序 + URL 同步
│   └── components/             # SearchBar, FilterPanel, FishCard, FishTable, FishDetail, PriceStars, StatsBar
├── index.html, vite.config.ts (base: './'), package.json, tsconfig.json
└── README.md
```

## 5. 前端功能規格

- **載入**：啟動時 fetch `data/fish.json`，建立小寫化搜尋字串索引。
- **搜尋**：單一輸入框，即時（debounce 150ms）子字串比對 name_zh / scientific / common_names / english_names / family_zh / name_cn / synonyms；支援多關鍵字以空白分隔（AND）。
- **篩選面板**（側欄，手機收合成抽屜）：
  - 科（可搜尋的多選清單，顯示各科筆數，依筆數排序）
  - 價格（★1–★5 多選 + 「未標示」）
  - 產期（春/夏/秋/冬/全年 多選）
  - 台灣分布（多選，依頻率排序）
  - 棲息環境（多選）
  - 有毒 / 食用 / 觀賞（三態：不限/是/否）
  - IUCN 狀態（多選）
  - 「清除全部」
  - 各選項計數隨其他條件動態更新（faceted counts）
- **排序**：中文名、學名、科名、價格（高→低/低→高）、最大體長、棲息深度。
- **檢視**：卡片（照片、中文名、學名斜體、科、★、俗名前三個、產期）/ 表格（同來源欄位 + 可點排序）。虛擬化非必要（499 筆），但圖片 `loading="lazy"`，失敗顯示佔位圖。
- **詳細面板**：點卡片開啟右側抽屜（手機全螢幕）：大圖（點擊開新分頁原圖）、基本資料格、分布/棲地、形態/生態/漁業利用長文、同種異名、連結至舊站與新站。支援 Esc 關閉、上下一筆。
- **URL 狀態**：`?q=&family=&price=&season=&region=&habitat=&toxic=&view=&sort=&id=` 以 `history.replaceState` 同步，可直接分享。
- **統計列**：目前符合筆數 / 總數；價格分布小長條。
- **頁尾**：來源聲明（中研院臺灣魚類資料庫、資料維護者）、價格僅供參考之原站聲明、資料抓取日期。
- **樣式**：不用 UI 框架，手寫 CSS 變數；`prefers-color-scheme` 深色；字體 system-ui / PingFang / Noto Sans TC。
- **品質**：`vue-tsc --noEmit` 通過；`npm run build` 可產出 dist；Vitest 針對 useFilters 的搜尋/篩選邏輯寫基本測試。

## 6. 執行分工

| 階段 | 執行者 | 產出 |
|---|---|---|
| 勘查與規劃 | Fable 5.1（本文件） | PLAN.md |
| 資料抓取腳本 + v1 資料集（名錄欄位） | Opus 5.5 sub-agent A | scripts/、data/list.json、public/data/fish.json |
| 前端應用 | Opus 5.5 sub-agent B | src/、index.html、package.json、README.md |
| 詳細頁完整抓取（約 25 分鐘，背景） | 主流程 | data/raw/、重新 build fish.json |
| 瀏覽器驗證 | Fable 5.1 | — |

## 7. 台灣地圖輔助（第二階段）

- 新元件 `src/components/TaiwanMap.vue`：inline SVG 簡化台灣圖（viewBox 約 0 0 320 440），本島沿岸分區以粗線段標示、離島以圓點標示；東沙、南沙、金門置於虛線「非等比例」小框內。
- 分區對應資料 `taiwan_regions` 的 16 個標籤：北部、東北部、東部、恆春半島、南部、西南部、中部、西部、澎湖、小琉球、綠島、蘭嶼、金門、東沙、南沙（「蘭嶼綠島」在 build_dataset.py 拆成兩個）。
- 兩種模式：`interactive`（篩選面板，點選切換 region 篩選，顯示動態筆數，與既有清單／chips／URL 同步）與 `readonly`（詳細面板，標示該魚種分布）。
- 鍵盤可操作（每區為可聚焦元素，aria-pressed）、hover 顯示名稱與筆數、深色模式、手機寬度自適應。
