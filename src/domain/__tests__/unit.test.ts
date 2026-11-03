import { describe, expect, it } from 'vitest'
import { fixed } from '../format'
import { defaultInsumos, defaultSelection, toChosenProducts } from '../insumos'
import { newSample } from '../model'
import { recommend } from '../recommendation'

describe('formatação igual ao Android', () => {
  it('arredonda meio para cima sobre o decimal curto', () => {
    expect(fixed(1.005, 2)).toBe('1,01')
    expect(fixed(2.5, 0)).toBe('3')
    expect(fixed(0.45, 1)).toBe('0,5')
    expect(fixed(1234567.891, 1)).toBe('1234567,9')
    expect(fixed(1e-7, 1)).toBe('0,0')
    expect(fixed(-0.4, 0)).toBe('-0')
    expect(fixed(9.96, 1)).toBe('10,0')
  })
})

describe('escolha inicial de adubos (como o Android)', () => {
  it('ureia, MAP e cloreto; S e micros só quando a recomendação pede', () => {
    const insumos = defaultInsumos()
    const s = newSample({ expectedYield: 80, k: 90, pMehlich: 8, pRem: 25, ca: 1.8, mg: 0.6, hAl: 4, sulfur: 4, zn: 1.5, b: 0.8 })
    const sel = defaultSelection(insumos, recommend(s))
    const nome = (id: string | undefined): string | undefined => insumos.find((i) => i.id === id)?.name
    expect(nome(sel.N)).toBe('Ureia')
    expect(nome(sel.P)).toBe('MAP')
    expect(nome(sel.K)).toBe('Cloreto de Potássio')
    expect(nome(sel.S)).toBe('Gesso Agrícola')
    expect(nome(sel.ZN)).toBe('FTE BR 12')
    expect(sel.B).toBeUndefined() // B 0,8 é adequado
    expect(toChosenProducts(sel, insumos).map((c) => c[2]).slice(0, 3)).toEqual(['P', 'K', 'N'])
  })
})
