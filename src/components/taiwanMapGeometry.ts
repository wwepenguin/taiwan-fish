/**
 * 台灣分布輔助地圖的幾何資料（手繪示意圖，非精確地圖）。
 *
 * 海岸線以經緯度控制點經簡單等距投影後，用 Catmull-Rom 曲線平滑成 SVG 路徑；
 * 本島沿岸分區直接取同一條曲線的片段，因此線段會貼齊島嶼輪廓。
 * 離島為圓點（位置依實際經緯度略作調整），金門／東沙／南沙放在左下「非等比例」框內。
 */

export const VIEW_W = 320
export const VIEW_H = 440

/** 資料中 `taiwan_regions` 的全部標籤（順序：本島沿岸順時針、離島、框內） */
export const TAIWAN_REGION_NAMES = [
  '北部',
  '東北部',
  '東部',
  '恆春半島',
  '南部',
  '西南部',
  '中部',
  '西部',
  '澎湖',
  '小琉球',
  '綠島',
  '蘭嶼',
  '金門',
  '東沙',
  '南沙',
] as const

export type TaiwanRegionName = (typeof TAIWAN_REGION_NAMES)[number]

export interface Pt {
  x: number
  y: number
}

export interface LabelAnchor extends Pt {
  anchor: 'start' | 'middle' | 'end'
}

export interface CoastRegion {
  kind: 'coast'
  name: TaiwanRegionName
  /** 沿海岸線的開放路徑 */
  d: string
  label: LabelAnchor
}

export interface IslandRegion {
  kind: 'island'
  name: TaiwanRegionName
  cx: number
  cy: number
  r: number
  /** 是否位於「非等比例」框內 */
  inset: boolean
  label: LabelAnchor
}

export type MapRegion = CoastRegion | IslandRegion

// ---------------------------------------------------------------- 投影

const X0 = 104
const Y0 = 26
const KX = 76 // px / 經度
const KY = 92 // px / 緯度（略拉長，讓島形更修長）
const LON0 = 120
const LAT0 = 25.3

const round = (n: number) => Math.round(n * 10) / 10

function project(lon: number, lat: number): Pt {
  return { x: round(X0 + (lon - LON0) * KX), y: round(Y0 + (LAT0 - lat) * KY) }
}

// ---------------------------------------------------------------- 海岸線（順時針，起點富貴角）

type Coast = readonly [lon: number, lat: number, boundary?: TaiwanRegionName]

/**
 * 第三個欄位標示「此點起為某分區」；分區延伸到下一個標示點為止。
 * 北部跨越起點，所以以最後的桃園海岸點標記。
 */
const COAST: readonly Coast[] = [
  [121.537, 25.297], // 富貴角
  [121.66, 25.22], // 野柳
  [121.76, 25.15, '東北部'], // 基隆
  [121.92, 25.12], // 鼻頭角
  [122.0, 25.0], // 三貂角
  [121.9, 24.9], // 頭城
  [121.83, 24.72], // 壯圍
  [121.87, 24.58], // 蘇澳
  [121.8, 24.44, '東部'], // 南澳
  [121.69, 24.2], // 清水斷崖
  [121.62, 23.97], // 花蓮
  [121.52, 23.6], // 豐濱
  [121.38, 23.12], // 成功
  [121.16, 22.76], // 台東
  [121.0, 22.58], // 太麻里
  [120.91, 22.38, '恆春半島'], // 大武
  [120.88, 22.17], // 旭海
  [120.87, 21.99], // 佳樂水
  [120.84, 21.9], // 鵝鑾鼻
  [120.74, 21.92], // 貓鼻頭
  [120.71, 22.04], // 車城
  [120.66, 22.21, '南部'], // 楓港
  [120.58, 22.36], // 枋寮
  [120.45, 22.47], // 東港
  [120.28, 22.6], // 高雄港
  [120.2, 22.8], // 梓官
  [120.16, 22.93, '西南部'], // 茄萣
  [120.1, 23.08], // 七股
  [120.11, 23.28], // 北門
  [120.14, 23.45], // 東石
  [120.16, 23.56, '中部'], // 口湖
  [120.18, 23.78], // 麥寮
  [120.31, 23.94], // 芳苑
  [120.43, 24.08], // 鹿港
  [120.51, 24.19, '西部'], // 大肚溪口
  [120.58, 24.36], // 大安
  [120.7, 24.54], // 通霄
  [120.86, 24.76], // 新竹
  [121.0, 24.96, '北部'], // 新竹／桃園交界
  [121.15, 25.08], // 觀音
  [121.38, 25.17], // 淡水
]

const COAST_PTS: Pt[] = COAST.map(([lon, lat]) => project(lon, lat))

// ---------------------------------------------------------------- 曲線

type Bezier = [Pt, Pt, Pt, Pt]

/** 封閉 Catmull-Rom → 每一段的三次貝茲控制點 */
function closedBeziers(pts: readonly Pt[], tension = 0.5): Bezier[] {
  const n = pts.length
  const at = (i: number) => pts[((i % n) + n) % n]!
  const k = tension / 3
  const out: Bezier[] = []
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    out.push([
      p1,
      { x: p1.x + (p2.x - p0.x) * k * 2, y: p1.y + (p2.y - p0.y) * k * 2 },
      { x: p2.x - (p3.x - p1.x) * k * 2, y: p2.y - (p3.y - p1.y) * k * 2 },
      p2,
    ])
  }
  return out
}

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })

/** de Casteljau：在 t 處把一段貝茲曲線切成兩半 */
function split(b: Bezier, t: number): [Bezier, Bezier] {
  const [p0, p1, p2, p3] = b
  const a = lerp(p0, p1, t)
  const m = lerp(p1, p2, t)
  const c = lerp(p2, p3, t)
  const d = lerp(a, m, t)
  const e = lerp(m, c, t)
  const f = lerp(d, e, t)
  return [
    [p0, a, d, f],
    [f, e, c, p3],
  ]
}

const chord = (b: Bezier) => Math.hypot(b[3].x - b[0].x, b[3].y - b[0].y)
const fmt = (p: Pt) => `${round(p.x)} ${round(p.y)}`

function pathFrom(segs: readonly Bezier[], close = false): string {
  if (!segs.length) return ''
  const parts = [`M${fmt(segs[0]![0])}`]
  for (const [, c1, c2, p] of segs) parts.push(`C${fmt(c1)} ${fmt(c2)} ${fmt(p)}`)
  if (close) parts.push('Z')
  return parts.join('')
}

const COAST_BEZ = closedBeziers(COAST_PTS)

/** 主島輪廓 */
export const ISLAND_PATH = pathFrom(COAST_BEZ, true)

/** 分區線段兩端各留下的空隙（px，含圓角端點） */
const SEGMENT_GAP = 6.5

function coastSegment(from: number, to: number): string {
  const n = COAST_BEZ.length
  const segs: Bezier[] = []
  for (let i = from; i !== to; i = (i + 1) % n) segs.push(COAST_BEZ[i]!)
  // 修剪兩端，讓相鄰分區之間留出可辨識的間隙
  const first = segs[0]!
  segs[0] = split(first, Math.min(0.4, SEGMENT_GAP / chord(first)))[1]
  const last = segs[segs.length - 1]!
  segs[segs.length - 1] = split(last, 1 - Math.min(0.4, SEGMENT_GAP / chord(last)))[0]
  return pathFrom(segs)
}

// ---------------------------------------------------------------- 中央山脈（淡色紡錘形 + 稜線）

const RANGE_PTS: Pt[] = (
  [
    [121.5, 24.82],
    [121.42, 24.35],
    [121.3, 23.8],
    [121.12, 23.25],
    [120.94, 22.72],
    [120.8, 22.3],
    [120.76, 22.42],
    [120.82, 22.9],
    [120.92, 23.4],
    [121.02, 23.9],
    [121.16, 24.4],
    [121.34, 24.78],
  ] as const
).map(([lon, lat]) => project(lon, lat))

export const MOUNTAIN_PATH = pathFrom(closedBeziers(RANGE_PTS), true)

/** 幾道短稜線（人字形），暗示山脈走向 */
export const RIDGE_PATHS: string[] = (
  [
    [121.36, 24.5],
    [121.22, 24.0],
    [121.08, 23.5],
    [120.94, 23.0],
    [120.84, 22.6],
  ] as const
).map(([lon, lat]) => {
  const c = project(lon, lat)
  return `M${round(c.x - 7)} ${round(c.y + 5)}L${c.x} ${c.y}L${round(c.x + 6)} ${round(c.y + 6)}`
})

// ---------------------------------------------------------------- 「非等比例」小框

export const INSET_BOX = { x: 6, y: 350, w: 96, h: 84, title: { x: 54, y: 365 } } as const

// ---------------------------------------------------------------- 分區

function buildCoastRegions(labels: Record<string, LabelAnchor>): CoastRegion[] {
  const starts = COAST.map((c, i) => ({ name: c[2], i })).filter(
    (s): s is { name: TaiwanRegionName; i: number } => !!s.name,
  )
  return starts.map((s, k) => {
    const next = starts[(k + 1) % starts.length]!
    return { kind: 'coast', name: s.name, d: coastSegment(s.i, next.i), label: labels[s.name]! }
  })
}

/** 沿岸分區的標籤位置：北部／東北部／東部在右上，西岸各區在左側 */
const COAST_LABELS: Record<string, LabelAnchor> = {
  北部: { x: 192, y: 30, anchor: 'end' },
  東北部: { x: 260, y: 86, anchor: 'start' },
  東部: { x: 232, y: 196, anchor: 'start' },
  恆春半島: { x: 162, y: 358, anchor: 'middle' },
  南部: { x: 114, y: 265, anchor: 'end' },
  西南部: { x: 97, y: 222, anchor: 'end' },
  中部: { x: 111, y: 156, anchor: 'end' },
  西部: { x: 144, y: 96, anchor: 'end' },
}

const island = (
  name: TaiwanRegionName,
  c: Pt,
  label: LabelAnchor,
  opts: { r?: number; inset?: boolean } = {},
): IslandRegion => ({ kind: 'island', name, cx: c.x, cy: c.y, r: opts.r ?? 8, inset: opts.inset ?? false, label })

const PENGHU = project(119.58, 23.57)
const LIUQIU = project(120.37, 22.34)
const GREEN = project(121.49, 22.66)
const ORCHID = project(121.55, 22.04)

export const MAP_REGIONS: MapRegion[] = [
  ...buildCoastRegions(COAST_LABELS),
  island('澎湖', PENGHU, { x: PENGHU.x - 13, y: PENGHU.y + 4, anchor: 'end' }, { r: 9 }),
  island('小琉球', LIUQIU, { x: LIUQIU.x - 12, y: LIUQIU.y + 4, anchor: 'end' }, { r: 7 }),
  island('綠島', GREEN, { x: GREEN.x + 12, y: GREEN.y + 4, anchor: 'start' }, { r: 7 }),
  island('蘭嶼', ORCHID, { x: ORCHID.x + 12, y: ORCHID.y + 4, anchor: 'start' }, { r: 7.5 }),
  island('金門', { x: 22, y: 381 }, { x: 34, y: 385, anchor: 'start' }, { r: 7, inset: true }),
  island('東沙', { x: 22, y: 401 }, { x: 34, y: 405, anchor: 'start' }, { r: 7, inset: true }),
  island('南沙', { x: 22, y: 421 }, { x: 34, y: 425, anchor: 'start' }, { r: 7, inset: true }),
]

export const REGION_BY_NAME: ReadonlyMap<string, MapRegion> = new Map(MAP_REGIONS.map((r) => [r.name, r]))
