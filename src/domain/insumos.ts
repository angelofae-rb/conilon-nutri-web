/** Insumos (adubos) e a escolha inicial de fontes — porte de `InsumoEntity` + `InsumoSelection.default`. */
import type { ChosenProduct } from './calculator'
import { microSymbol } from './calculator'
import type { Recommendation } from './recommendation'
import { uid } from './model'

export interface Insumo {
  id: string; name: string
  n: number; p2o5: number; k2o: number; ca: number; mg: number; s: number
  b: number; cu: number; fe: number; mn: number; zn: number; mo: number
  pricePerBag: number; bagWeightKg: number
}

export function newInsumo(name: string, g: Partial<Insumo> = {}): Insumo {
  return {
    id: uid(), name, n: 0, p2o5: 0, k2o: 0, ca: 0, mg: 0, s: 0, b: 0, cu: 0, fe: 0, mn: 0, zn: 0, mo: 0,
    pricePerBag: 0, bagWeightKg: 50, ...g,
  }
}

/** Mesma lista que o app Android cadastra na primeira abertura. */
export function defaultInsumos(): Insumo[] {
  return [
    newInsumo('Ureia', { n: 45 }),
    newInsumo('Sulfato de Amônio', { n: 21, s: 24 }),
    newInsumo('Super Simples', { p2o5: 18, s: 10, ca: 18 }),
    newInsumo('Super Triplo', { p2o5: 41, ca: 12 }),
    newInsumo('MAP', { n: 11, p2o5: 48 }),
    newInsumo('Cloreto de Potássio', { k2o: 60 }),
    newInsumo('20-00-20', { n: 20, k2o: 20 }),
    newInsumo('04-14-08', { n: 4, p2o5: 14, k2o: 8 }),
    newInsumo('FTE BR 12', { s: 3.9, b: 1.8, cu: 0.8, mn: 2, zn: 9 }),
    newInsumo('Calcário', { ca: 30, mg: 15, bagWeightKg: 1000 }),
    newInsumo('Gesso Agrícola', { ca: 18, s: 15 }),
    newInsumo('Composto Orgânico', { n: 1.5, p2o5: 1, k2o: 1, ca: 4, mg: 1, mo: 45, bagWeightKg: 1000 }),
  ]
}

/** Ordem do banco do Android (ORDER BY name, comparação binária). */
export const sortInsumos = (l: Insumo[]): Insumo[] => [...l].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

export function concentration(i: Insumo, symbol: string): number {
  switch (symbol.toUpperCase()) {
    case 'B': return i.b
    case 'ZN': return i.zn
    case 'CU': return i.cu
    case 'MN': return i.mn
    case 'FE': return i.fe
    case 'S': return i.s
    default: return 0
  }
}

/** O micronutriente de maior garantia no insumo ("ZN" no FTE BR 12); null se não tem micro. */
export function mainMicro(i: Insumo): string | null {
  return maxBy(['B', 'ZN', 'CU', 'MN', 'FE'].filter((s) => concentration(i, s) > 0), (s) => concentration(i, s)) ?? null
}

export function toNutrientMap(i: Insumo): Record<string, number> {
  return {
    N: i.n, P2O5: i.p2o5, K2O: i.k2o, S: i.s, Ca: i.ca, Mg: i.mg,
    B: i.b, CU: i.cu, FE: i.fe, MN: i.mn, ZN: i.zn,
    bagWeightKg: i.bagWeightKg, pricePerBag: i.pricePerBag,
  }
}

/** Fonte escolhida por alvo ("N", "P", "K", "S", "B", "ZN"...) -> id do insumo. */
export type InsumoSelection = Record<string, string>

const maxBy = <T>(l: T[], f: (x: T) => number): T | undefined =>
  l.reduce<T | undefined>((best, x) => (best === undefined || f(x) > f(best) ? x : best), undefined)

/** Escolha inicial: S e micros só ganham fonte se a recomendação pede dose. */
export function defaultSelection(insumosIn: Insumo[], rec: Recommendation): InsumoSelection {
  const insumos = sortInsumos(insumosIn)
  const sel: InsumoSelection = {}
  const n = insumos.find((i) => i.n > 40) ?? insumos.find((i) => i.n > 0)
  const p = insumos.find((i) => i.p2o5 > 40) ?? insumos.find((i) => i.p2o5 > 0)
  const k = insumos.find((i) => i.k2o > 50) ?? insumos.find((i) => i.k2o > 0)
  if (n) sel.N = n.id
  if (p) sel.P = p.id
  if (k) sel.K = k.id
  if (rec.sulfur.recommendationKgPerHa > 0) {
    const s = maxBy(insumos.filter((i) => i.s > 10 && i.n === 0 && i.p2o5 === 0), (i) => i.s) ??
      maxBy(insumos.filter((i) => i.s > 0), (i) => i.s)
    if (s) sel.S = s.id
  }
  // Um adubo com vários micros (FTE) só é fonte do micro que ele mais traz (FTE BR 12 = zinco);
  // os outros recebem o bônus dele e, se ainda faltar, a tela mostra o que falta.
  for (const m of rec.micronutrients.filter((x) => (x.recKgHa ?? 0) > 0)) {
    const sym = microSymbol(m)
    const best = maxBy(insumos.filter((i) => concentration(i, sym) > 0 && mainMicro(i) === sym), (i) => concentration(i, sym))
    if (best) sel[sym] = best.id
  }
  return sel
}

/** Ordem do Android: P, K, N e depois os demais alvos. */
export function toChosenProducts(sel: InsumoSelection, insumos: Insumo[]): ChosenProduct[] {
  const byId = new Map(insumos.map((i) => [i.id, i]))
  const out: ChosenProduct[] = []
  const push = (target: string): void => {
    const i = sel[target] ? byId.get(sel[target]) : undefined
    if (i) out.push([i.name, toNutrientMap(i), target])
  }
  push('P'); push('K'); push('N')
  for (const t of Object.keys(sel)) if (!['P', 'K', 'N'].includes(t)) push(t)
  return out
}
