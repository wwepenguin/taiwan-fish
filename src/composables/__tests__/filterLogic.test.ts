import { describe, expect, it } from 'vitest'
import type { Fish } from '../../types'
import {
  applyFilters,
  buildSearchText,
  computeFacetCounts,
  createDefaultState,
  facetOptions,
  hasActiveFilters,
  indexFish,
  matchesTokens,
  parseQuery,
  serializeState,
  sortFish,
  toCriteria,
  tokenize,
} from '../filterLogic'

function makeFish(p: Partial<Fish> & Pick<Fish, 'id'>): Fish {
  return {
    family_id: 'F000',
    family_zh: '未知科',
    family_latin: null,
    scientific: 'Genus species',
    author: null,
    name_zh: '魚',
    name_cn: null,
    common_names: [],
    english_names: [],
    synonyms: [],
    season: '',
    season_tags: [],
    price: null,
    photo_thumb: null,
    photo_large: null,
    depth_min: null,
    depth_max: null,
    depth_text: null,
    max_length_cm: null,
    max_length_text: null,
    toxic: null,
    edible: null,
    ornamental: null,
    economic: null,
    distribution_world: null,
    distribution_taiwan: null,
    taiwan_regions: [],
    habitat: null,
    habitat_tags: [],
    type_locality: null,
    iucn_code: null,
    iucn_text: null,
    morphology: null,
    ecology: null,
    distribution_desc: null,
    fishery_use: null,
    references: null,
    source_url: `https://fishdb.sinica.edu.tw/chi/species.php?id=${p.id}`,
    new_site_url: `https://fishdb.sinica.edu.tw/taxon/${p.id}-fishdb`,
    detail_fetched: false,
    ...p,
  }
}

const RAW: Fish[] = [
  makeFish({
    id: '1',
    family_id: 'F370',
    family_zh: '笛鯛科',
    family_latin: 'Lutjanidae',
    scientific: 'Symphorus nematophorus',
    name_zh: '曳絲笛鯛',
    common_names: ['紅雞', '加吉'],
    english_names: ['Chinamanfish'],
    price: 4,
    season_tags: ['春', '夏'],
    taiwan_regions: ['南部', '澎湖'],
    habitat_tags: ['岩礁'],
    max_length_cm: 100,
    depth_min: 10,
    depth_max: 50,
    edible: true,
    toxic: false,
    iucn_code: 'NL',
    detail_fetched: true,
  }),
  makeFish({
    id: '2',
    family_id: 'F370',
    family_zh: '笛鯛科',
    scientific: 'Lutjanus argentimaculatus',
    name_zh: '銀紋笛鯛',
    name_cn: '紫红笛鲷',
    common_names: ['紅槽'],
    price: 5,
    season_tags: ['全年'],
    taiwan_regions: ['南部'],
    habitat_tags: ['河口', '岩礁'],
    max_length_cm: 150,
    depth_min: 1,
    depth_max: 120,
    edible: true,
    toxic: null,
    iucn_code: 'LC',
  }),
  makeFish({
    id: '3',
    family_id: 'F100',
    family_zh: '鯖科',
    scientific: 'Scomber japonicus',
    name_zh: '白腹鯖',
    english_names: ['Chub mackerel'],
    synonyms: ['Pneumatophorus japonicus'],
    price: 2,
    season_tags: ['冬'],
    taiwan_regions: ['東北部'],
    habitat_tags: ['大洋'],
    max_length_cm: 64,
    toxic: false,
  }),
  makeFish({
    id: '4',
    family_id: 'F200',
    family_zh: '四齒魨科',
    scientific: 'Lagocephalus lunaris',
    name_zh: '月尾兔頭魨',
    common_names: ['金乖'],
    price: null,
    toxic: true,
    edible: false,
  }),
]
const ITEMS = indexFish(RAW)

function filterIds(patch: Partial<ReturnType<typeof createDefaultState>>) {
  const s = { ...createDefaultState(), ...patch }
  return applyFilters(ITEMS, toCriteria(s)).map((f) => f.id)
}

describe('search', () => {
  it('tokenize splits on half/full-width spaces, lowercases and dedupes', () => {
    expect(tokenize('  Lutjanus　笛鯛  lutjanus ')).toEqual(['lutjanus', '笛鯛'])
    expect(tokenize('   ')).toEqual([])
  })

  it('search text covers every searchable field, lowercased', () => {
    const t = buildSearchText(RAW[2]!)
    for (const s of ['白腹鯖', 'scomber japonicus', 'chub mackerel', '鯖科', 'pneumatophorus']) {
      expect(t).toContain(s)
    }
    expect(matchesTokens(t, ['chub', '鯖'])).toBe(true)
    expect(matchesTokens(t, ['chub', '笛鯛'])).toBe(false)
  })

  it('multi-keyword search is AND and case-insensitive', () => {
    expect(filterIds({ q: '笛鯛' })).toEqual(['1', '2'])
    expect(filterIds({ q: '笛鯛 紅雞' })).toEqual(['1'])
    expect(filterIds({ q: 'CHINAMAN' })).toEqual(['1'])
    expect(filterIds({ q: '紫红' })).toEqual(['2']) // 大陸名
    expect(filterIds({ q: 'pneumato' })).toEqual(['3']) // 同種異名
    expect(filterIds({ q: '笛鯛 鯖' })).toEqual([])
  })
})

describe('filters', () => {
  it('no criteria returns everything in original order', () => {
    expect(filterIds({})).toEqual(['1', '2', '3', '4'])
  })

  it('values within a facet are OR, facets are AND', () => {
    expect(filterIds({ price: ['2', '4'] })).toEqual(['1', '3'])
    expect(filterIds({ price: ['none'] })).toEqual(['4'])
    expect(filterIds({ family: ['F370'], price: ['5'] })).toEqual(['2'])
    expect(filterIds({ region: ['南部'], habitat: ['河口'] })).toEqual(['2'])
    expect(filterIds({ iucn: ['none'] })).toEqual(['3', '4'])
  })

  it('全年 matches every season, but selecting 全年 only matches all-year fish', () => {
    expect(filterIds({ season: ['冬'] })).toEqual(['2', '3'])
    expect(filterIds({ season: ['全年'] })).toEqual(['2'])
  })

  it('tri-state: null only passes when set to any', () => {
    expect(filterIds({ toxic: 'yes' })).toEqual(['4'])
    expect(filterIds({ toxic: 'no' })).toEqual(['1', '3'])
    expect(filterIds({ edible: 'yes', toxic: 'no' })).toEqual(['1'])
  })
})

describe('facet counts', () => {
  it('each facet ignores its own selection but honours the others', () => {
    const s = { ...createDefaultState(), family: ['F370'], price: ['4'] }
    const c = computeFacetCounts(ITEMS, toCriteria(s))
    // price counts: only family filter applies
    expect(c.multi.price.get('4')).toBe(1)
    expect(c.multi.price.get('5')).toBe(1)
    expect(c.multi.price.get('2')).toBeUndefined()
    // family counts: only price filter applies
    expect(c.multi.family.get('F370')).toBe(1)
    expect(c.multi.family.get('F100')).toBeUndefined()
    // other facets: both filters apply → only fish 1
    expect(c.multi.region.get('澎湖')).toBe(1)
    expect(c.tri.edible).toEqual({ yes: 1, no: 0 })
  })

  it('counts respect the search query and season 全年 expansion', () => {
    const s = { ...createDefaultState(), q: '笛鯛' }
    const c = computeFacetCounts(ITEMS, toCriteria(s))
    expect(c.multi.season.get('春')).toBe(2)
    expect(c.multi.season.get('冬')).toBe(1)
    expect(c.multi.season.get('全年')).toBe(1)
    expect(c.multi.habitat.get('岩礁')).toBe(2)
  })

  it('facetOptions orders by count, with fixed order for price/season/iucn', () => {
    expect(facetOptions(RAW, 'family').map((o) => o.value)[0]).toBe('F370')
    expect(facetOptions(RAW, 'price').map((o) => o.value)).toEqual(['1', '2', '3', '4', '5', 'none'])
    expect(facetOptions(RAW, 'season').map((o) => o.count)).toEqual([2, 2, 1, 2, 1])
    expect(facetOptions(RAW, 'iucn').map((o) => o.value)).toEqual(['LC', 'NL', 'none'])
  })
})

describe('sort', () => {
  const ids = (field: Parameters<typeof sortFish>[1], dir: 'asc' | 'desc') =>
    sortFish(RAW, field, dir).map((f) => f.id)

  it('does not mutate input', () => {
    const copy = [...RAW]
    sortFish(RAW, 'price', 'desc')
    expect(RAW).toEqual(copy)
  })

  it('numeric sorts put null last in both directions', () => {
    expect(ids('price', 'desc')).toEqual(['2', '1', '3', '4'])
    expect(ids('price', 'asc')).toEqual(['3', '1', '2', '4'])
    expect(ids('length', 'desc')).toEqual(['2', '1', '3', '4'])
    expect(ids('depth', 'asc')).toEqual(['2', '1', '3', '4'])
    expect(ids('depth', 'desc')).toEqual(['2', '1', '3', '4'])
  })

  it('text sorts and default order', () => {
    expect(ids('scientific', 'asc')).toEqual(['4', '2', '3', '1'])
    expect(ids('scientific', 'desc')).toEqual(['1', '3', '2', '4'])
    expect(ids('default', 'asc')).toEqual(['1', '2', '3', '4'])
    expect(ids('default', 'desc')).toEqual(['4', '3', '2', '1'])
    expect(ids('name', 'asc')).toHaveLength(4)
    // family sort keeps same-family fish together
    const fam = ids('family', 'asc')
    expect(Math.abs(fam.indexOf('1') - fam.indexOf('2'))).toBe(1)
  })
})

describe('URL state', () => {
  it('round-trips through serialize/parse', () => {
    const s = {
      ...createDefaultState(),
      q: '笛鯛 紅',
      family: ['F370', 'F100'],
      price: ['5', 'none'],
      season: ['冬'],
      region: ['南部'],
      habitat: ['岩礁'],
      iucn: ['LC'],
      toxic: 'no' as const,
      edible: 'yes' as const,
      view: 'table' as const,
      sort: 'price' as const,
      dir: 'desc' as const,
      id: '382143',
    }
    expect(parseQuery(`?${serializeState(s)}`)).toEqual(s)
  })

  it('omits defaults', () => {
    expect(serializeState(createDefaultState())).toBe('')
  })

  it('drops invalid values', () => {
    const s = parseQuery('?price=9,3&season=夏,x&toxic=maybe&view=grid&sort=bogus-up&id=<x>')
    expect(s.price).toEqual(['3'])
    expect(s.season).toEqual(['夏'])
    expect(s.toxic).toBe('any')
    expect(s.view).toBe('card')
    expect(s.sort).toBe('default')
    expect(s.id).toBeNull()
  })

  it('sort without direction uses the field default', () => {
    expect(parseQuery('?sort=price')).toMatchObject({ sort: 'price', dir: 'desc' })
  })

  it('hasActiveFilters ignores view/sort/id', () => {
    expect(hasActiveFilters({ ...createDefaultState(), view: 'table', id: '1' })).toBe(false)
    expect(hasActiveFilters({ ...createDefaultState(), edible: 'no' })).toBe(true)
  })
})
