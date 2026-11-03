/**
 * Modelos do domínio, portados de `domain/model` do app Android (Kotlin).
 * Mantenha os dois lados iguais: o teste `golden.test.ts` compara o cálculo daqui com o do Kotlin.
 */

export type NutritionalStatus = 'LOW' | 'MEDIUM' | 'GOOD'
export const STATUS_LABEL: Record<NutritionalStatus, string> = { LOW: 'Baixo', MEDIUM: 'Médio', GOOD: 'Bom' }

/**
 * Estágio do talhão. "Plantio" = ainda não plantado (P₂O₅ e micros na cova, calcário incorporado);
 * "1º ano" e "2º ano" = lavoura já plantada (só N e K₂O em cobertura). A ordem é a dos botões.
 */
export type Stage = 'PLANTING' | 'FORMATION_YEAR_1' | 'FORMATION_YEAR_2' | 'PRODUCTION'
export const STAGES: Stage[] = ['PLANTING', 'FORMATION_YEAR_1', 'FORMATION_YEAR_2', 'PRODUCTION']
export const STAGE_CODE: Record<Stage, number> = { PLANTING: 3, FORMATION_YEAR_1: 1, FORMATION_YEAR_2: 2, PRODUCTION: 0 }
export const STAGE_LABEL: Record<Stage, string> = {
  PLANTING: 'Formação - Plantio',
  FORMATION_YEAR_1: 'Formação - 1º ano',
  FORMATION_YEAR_2: 'Formação - 2º ano',
  PRODUCTION: 'Produção',
}
export const stageShort = (s: Stage): string => {
  const l = STAGE_LABEL[s]
  const i = l.indexOf('- ')
  return i >= 0 ? l.slice(i + 2) : l
}
export const isFormation = (s: Stage): boolean => s !== 'PRODUCTION'
export const isPlanting = (s: Stage): boolean => s === 'PLANTING'
export const formationYear = (s: Stage): number =>
  s === 'PLANTING' || s === 'FORMATION_YEAR_1' ? 1 : s === 'FORMATION_YEAR_2' ? 2 : 0
export function stageFromCode(code: number): Stage {
  return (Object.keys(STAGE_CODE) as Stage[]).find((s) => STAGE_CODE[s] === code) ?? 'PRODUCTION'
}

/** Amostra de solo (laudo) + contexto de manejo copiado do talhão. Campo vazio = 0. */
export interface SoilSample {
  id: string
  talhaoId: string | null
  sampleNumber: string
  dateMillis: number
  stage: Stage
  rowSpacing: number
  plantSpacing: number
  expectedYield: number
  numSplits: number
  ph: number
  organicMatter: number
  pMehlich: number
  pRem: number
  k: number
  ca: number
  mg: number
  hAl: number
  al: number
  sulfur: number
  clay: number
  b: number
  cu: number
  fe: number
  mn: number
  zn: number
  safraId: string | null
  subCa: number
  subMg: number
  subK: number
  subHAl: number
  subAl: number
}

export function newSample(partial: Partial<SoilSample> = {}): SoilSample {
  return {
    id: uid(),
    talhaoId: null,
    sampleNumber: '',
    dateMillis: Date.now(),
    stage: 'PRODUCTION',
    rowSpacing: 3.0,
    plantSpacing: 1.0,
    expectedYield: 80.0,
    numSplits: 4,
    ph: 0, organicMatter: 0, pMehlich: 0, pRem: 0, k: 0, ca: 0, mg: 0, hAl: 0, al: 0,
    sulfur: 0, clay: 0, b: 0, cu: 0, fe: 0, mn: 0, zn: 0, safraId: null,
    subCa: 0, subMg: 0, subK: 0, subHAl: 0, subAl: 0,
    ...partial,
  }
}

/** Algum campo da camada de 20–40 cm foi preenchido. */
export const hasAnySubsoilData = (s: SoilSample): boolean =>
  s.subCa > 0 || s.subMg > 0 || s.subK > 0 || s.subHAl > 0 || s.subAl > 0

/** Camada de 20–40 cm utilizável: H+Al e pelo menos Ca ou Mg. */
export const hasSubsoilLayer = (s: SoilSample): boolean => s.subHAl > 0 && (s.subCa > 0 || s.subMg > 0)

export interface Talhao {
  id: string
  name: string
  producerName: string
  stage: Stage
  rowSpacing: number
  plantSpacing: number
  expectedYield: number
  numSplits: number
  createdAtMillis: number
  areaHa: number
  plantingDateMillis: number | null
}

export const plantsPerHaOf = (t: { rowSpacing: number; plantSpacing: number }): number =>
  t.rowSpacing > 0 && t.plantSpacing > 0 ? Math.trunc(10000 / (t.rowSpacing * t.plantSpacing)) : 0

export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && 'randomUUID' in c) return c.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}
