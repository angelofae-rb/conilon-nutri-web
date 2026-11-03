/**
 * Projeção INDICATIVA de produtividade — porte de `YieldProjection.kt`. Sem tabela publicada por trás:
 * serve para mostrar qual nutriente mais limita, não para prometer sacas.
 */
import { microSymbol } from './calculator'
import { isFormation } from './model'
import type { Recommendation } from './recommendation'
import { buscarDose, productionK2OTable } from './tables'

export const MAX_LOSS: Record<string, number> = { N: 0.35, P: 0.15, K: 0.2, B: 0.12, ZN: 0.08, CU: 0.03, FE: 0.04, MN: 0.04 }
export const RANGE_PESSIMISTIC = 1.4
export const RANGE_OPTIMISTIC = 0.6
const LOSS_CAP = 0.9
const MIN_VISIBLE_LOSS = 0.3

export interface YieldScenario { scHa: number; pessimistic: number; optimistic: number }
export interface YieldLimit { key: string; label: string; lossScHaSoil: number; lossScHaApplied: number; fixable: boolean }
export interface YieldProjection {
  potentialScHa: number; areaHa: number; soilOnly: YieldScenario; withApplied: YieldScenario; limits: YieldLimit[]
}

interface Item { key: string; label: string; need: number; doseKgHa: number; appliedKgHa: number; maxLoss: number; unfixable: boolean }
const cover = (it: Item): number =>
  it.unfixable ? 0 : it.doseKgHa <= 0 ? 1 : Math.min(1, Math.max(0, it.appliedKgHa / it.doseKgHa))
const loss = (it: Item, withApplied: boolean, scale = 1.0): number =>
  Math.min(LOSS_CAP, it.maxLoss * it.need * (withApplied ? 1 - cover(it) : 1) * scale)

export function projectYield(rec: Recommendation, applied: Record<string, number>, areaHa = 0): YieldProjection | null {
  const s = rec.sample
  if (isFormation(s.stage)) return null
  const potential = s.expectedYield
  if (potential <= 0) return null
  const items: Item[] = []
  const item = (key: string, label: string, need: number, dose: number, unfixable = false): void => {
    items.push({ key, label, need, doseKgHa: dose, appliedKgHa: applied[key] ?? 0, maxLoss: MAX_LOSS[key], unfixable })
  }
  item('N', 'Nitrogênio (N)', 1.0, rec.npk.nKgPerHa)
  const pNeed = { VERY_LOW: 1.0, LOW: 0.8, MEDIUM: 0.4, HIGH: 0.0 }[rec.npk.phosphorusClass]
  item('P', 'Fósforo (P₂O₅)', pNeed, rec.npk.p2o5KgPerHa)
  const kRef = buscarDose(productionK2OTable(0), potential)
  const kNeed = rec.npk.k2oKgPerHa <= 0 ? 0 : kRef <= 0 ? 1 : Math.min(1, rec.npk.k2oKgPerHa / kRef)
  item('K', 'Potássio (K₂O)', kNeed, rec.npk.k2oKgPerHa)
  for (const m of rec.micronutrients) {
    const sym = microSymbol(m)
    if (MAX_LOSS[sym] === undefined) continue
    const need = m.status === 'LOW' ? 1.0 : m.status === 'MEDIUM' ? 0.4 : 0.0
    const dose = m.recKgHa ?? 0
    items.push({ key: sym, label: m.nutrient, need, doseKgHa: dose, appliedKgHa: applied[sym] ?? 0, maxLoss: MAX_LOSS[sym], unfixable: need > 0 && dose <= 0 })
  }
  const scenario = (withApplied: boolean): YieldScenario => {
    const at = (scale: number): number => potential * items.reduce((acc, it) => acc * (1 - loss(it, withApplied, scale)), 1.0)
    return { scHa: at(1.0), pessimistic: at(RANGE_PESSIMISTIC), optimistic: at(RANGE_OPTIMISTIC) }
  }
  const limits = items
    .map((it) => ({ key: it.key, label: it.label, lossScHaSoil: potential * loss(it, false), lossScHaApplied: potential * loss(it, true), fixable: !it.unfixable }))
    .filter((l) => l.lossScHaSoil > MIN_VISIBLE_LOSS)
    .sort((a, b) => (b.lossScHaApplied - a.lossScHaApplied) || (b.lossScHaSoil - a.lossScHaSoil))
  return { potentialScHa: potential, areaHa, soilOnly: scenario(false), withApplied: scenario(true), limits }
}
