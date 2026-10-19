import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  INSET_BOX,
  ISLAND_PATH,
  MAP_REGIONS,
  TAIWAN_REGION_NAMES,
  VIEW_H,
  VIEW_W,
} from '../taiwanMapGeometry'

const EXPECTED = [
  '北部', '東北部', '東部', '恆春半島', '南部', '西南部', '中部', '西部',
  '澎湖', '小琉球', '綠島', '蘭嶼', '金門', '東沙', '南沙',
]

describe('taiwanMapGeometry', () => {
  it('covers exactly the 15 taiwan_regions tags, each once', () => {
    const names = MAP_REGIONS.map((r) => r.name)
    expect(new Set(names).size).toBe(names.length)
    expect([...names].sort()).toEqual([...EXPECTED].sort())
    expect([...TAIWAN_REGION_NAMES].sort()).toEqual([...EXPECTED].sort())
  })

  it('draws main-island zones as coast segments and offshore islands as circles', () => {
    const coast = MAP_REGIONS.filter((r) => r.kind === 'coast').map((r) => r.name)
    expect(coast).toEqual(expect.arrayContaining(['北部', '東北部', '東部', '恆春半島', '南部', '西南部', '中部', '西部']))
    expect(coast).toHaveLength(8)
    const inset = MAP_REGIONS.filter((r) => r.kind === 'island' && r.inset).map((r) => r.name)
    expect(inset.sort()).toEqual(['南沙', '東沙', '金門'].sort())
  })

  it('keeps every shape and label inside the viewBox (inset items inside the inset box)', () => {
    expect(ISLAND_PATH.startsWith('M')).toBe(true)
    expect(ISLAND_PATH.endsWith('Z')).toBe(true)
    for (const r of MAP_REGIONS) {
      expect(r.label.x).toBeGreaterThanOrEqual(0)
      expect(r.label.x).toBeLessThanOrEqual(VIEW_W)
      expect(r.label.y).toBeGreaterThan(0)
      expect(r.label.y).toBeLessThanOrEqual(VIEW_H)
      if (r.kind === 'coast') {
        const nums = r.d.match(/-?\d+(\.\d+)?/g)!.map(Number)
        expect(nums.length).toBeGreaterThan(0)
        for (let i = 0; i < nums.length; i += 2) {
          expect(nums[i]).toBeGreaterThanOrEqual(0)
          expect(nums[i]).toBeLessThanOrEqual(VIEW_W)
          expect(nums[i + 1]).toBeGreaterThanOrEqual(0)
          expect(nums[i + 1]).toBeLessThanOrEqual(VIEW_H)
        }
      } else if (r.inset) {
        expect(r.cx).toBeGreaterThan(INSET_BOX.x)
        expect(r.cx).toBeLessThan(INSET_BOX.x + INSET_BOX.w)
        expect(r.cy).toBeGreaterThan(INSET_BOX.y)
        expect(r.cy).toBeLessThan(INSET_BOX.y + INSET_BOX.h)
      }
    }
  })

  it('matches the tags present in public/data/fish.json', () => {
    const file = fileURLToPath(new URL('../../../public/data/fish.json', import.meta.url))
    const fish = JSON.parse(readFileSync(file, 'utf8')) as { taiwan_regions: string[] }[]
    const tags = new Set(fish.flatMap((f) => f.taiwan_regions))
    expect([...tags].sort()).toEqual([...EXPECTED].sort())
  })
})
