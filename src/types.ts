/** 單一魚種資料（對應 public/data/fish.json 的每一筆；詳細頁欄位未抓取時為 null / []） */
export interface Fish {
  id: string
  family_id: string
  family_zh: string
  family_latin: string | null
  scientific: string
  author: string | null
  name_zh: string
  name_cn: string | null
  common_names: string[]
  english_names: string[]
  synonyms: string[]
  season: string
  season_tags: string[]
  price: 1 | 2 | 3 | 4 | 5 | null
  photo_thumb: string | null
  photo_large: string | null
  depth_min: number | null
  depth_max: number | null
  depth_text: string | null
  max_length_cm: number | null
  max_length_text: string | null
  toxic: boolean | null
  edible: boolean | null
  ornamental: boolean | null
  economic: boolean | null
  distribution_world: string | null
  distribution_taiwan: string | null
  taiwan_regions: string[]
  habitat: string | null
  habitat_tags: string[]
  type_locality: string | null
  iucn_code: string | null
  iucn_text: string | null
  morphology: string | null
  ecology: string | null
  distribution_desc: string | null
  fishery_use: string | null
  references: string | null
  source_url: string
  new_site_url: string
  detail_fetched: boolean
}

/** public/data/meta.json */
export interface Meta {
  generated_at: string
  total: number
  detail_fetched: number
  source: string
  source_url?: string
}

/** 附加小寫化搜尋字串的資料列 */
export interface IndexedFish extends Fish {
  readonly _text: string
}

export type Tri = 'any' | 'yes' | 'no'
export type MultiFacet = 'family' | 'price' | 'season' | 'region' | 'habitat' | 'iucn'
export type TriFacet = 'toxic' | 'edible' | 'ornamental'
export type FacetKey = MultiFacet | TriFacet
export type SortField = 'default' | 'name' | 'scientific' | 'family' | 'price' | 'length' | 'depth'
export type SortDir = 'asc' | 'desc'
export type ViewMode = 'card' | 'table'

export interface FilterState {
  q: string
  family: string[]
  price: string[]
  season: string[]
  region: string[]
  habitat: string[]
  iucn: string[]
  toxic: Tri
  edible: Tri
  ornamental: Tri
  sort: SortField
  dir: SortDir
  view: ViewMode
  id: string | null
}
