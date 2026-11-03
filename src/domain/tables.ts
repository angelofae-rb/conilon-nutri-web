/**
 * TABELAS OFICIAIS — Incaper, Café Conilon, 3ª ed. (2019), cap. 14; classes do Guia de
 * interpretação (Incaper, 2013). Porte fiel de `AgronomicTables.kt` do app Android.
 * O que NÃO é do Incaper está marcado como "valor de referência do app".
 */
import type { NutritionalStatus } from './model'

export interface FaixaDose { min: number; max: number; dose: number }
const MAX = Number.MAX_VALUE
const fx = (min: number, max: number, dose: number): FaixaDose => ({ min, max, dose })

/** Dose da faixa em que o valor cai; o vão entre faixas pertence à faixa de cima. */
export function buscarDose(faixas: FaixaDose[], valor: number): number {
  if (faixas.length === 0 || Number.isNaN(valor) || valor < faixas[0].min) return 0
  return (faixas.find((f) => valor <= f.max) ?? faixas[faixas.length - 1]).dose
}

export type PhosphorusClass = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH'
export const P_CLASS_LABEL: Record<PhosphorusClass, string> = {
  VERY_LOW: 'Muito baixo', LOW: 'Baixo', MEDIUM: 'Médio', HIGH: 'Alto',
}
export const P_CLASS_STATUS: Record<PhosphorusClass, NutritionalStatus> = {
  VERY_LOW: 'LOW', LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'GOOD',
}

// FORMAÇÃO — N (g/planta/ano): Tabela 6, 15 e 30 g por aplicação × 3.
export function formationNitrogenDose(year: number): number {
  if (year === 1) return 45.0
  if (year === 2) return 90.0
  throw new Error(`Ano de formação inválido: ${year}. Apenas 1 ou 2 são suportados.`)
}

// FORMAÇÃO — K₂O (g/planta/ano) por K no solo (mg/dm³). Tabela 6 × 3 aplicações.
export const formationK2OYear1: FaixaDose[] = [fx(0, 59.9, 90), fx(60, 120, 60), fx(120.1, 200, 30), fx(200.1, MAX, 0)]
export const formationK2OYear2: FaixaDose[] = [fx(0, 59.9, 120), fx(60, 120, 90), fx(120.1, 200, 60), fx(200.1, MAX, 0)]

/** PLANTIO — P₂O₅ por cova de 40×40×40 cm (Tabela 5): 50 / 40 / 30 g. */
export function formationP2O5GramsPerPlant(cls: PhosphorusClass): number {
  switch (cls) {
    case 'VERY_LOW':
    case 'LOW': return 50.0
    case 'MEDIUM': return 40.0
    case 'HIGH': return 30.0
  }
}

/** Tabela 5, em sulco: 80 / 60 / 40 g de P₂O₅ por metro. */
export function furrowP2O5GramsPerMeter(cls: PhosphorusClass): number {
  switch (cls) {
    case 'VERY_LOW':
    case 'LOW': return 80.0
    case 'MEDIUM': return 60.0
    case 'HIGH': return 40.0
  }
}

export const P_REM_ASSUMED = 25.0

/**
 * Classe de P para o PLANTIO (Tabela 5), por P-rem: <20 → <10 | 10–20 | >20;
 * 20–40 → <20 | 20–50 | >50; >40 → <30 | 30–60 | >60.
 */
export function plantingPhosphorusClass(pMehlich: number, pRemInformed: number): PhosphorusClass {
  const pRem = pRemInformed <= 0 ? P_REM_ASSUMED : pRemInformed
  const [baixoAte, medioAte] = pRem < 20 ? [10, 20] : pRem <= 40 ? [20, 50] : [30, 60]
  if (pMehlich < baixoAte) return 'LOW'
  if (pMehlich <= medioAte) return 'MEDIUM'
  return 'HIGH'
}

export const FORMATION_SPLITS = 3
export const PLANTING_ZN_BELOW_MG_DM3 = 6.0
export const PLANTING_B_BELOW_MG_DM3 = 0.6
export const PLANTING_ZN_G_PER_PIT = 2.5
export const PLANTING_B_G_PER_PIT = 1.0
export const PLANTING_MN_G_PER_PIT_TABULEIRO = 2.0
export const PLANTING_FE_G_PER_PIT_TABULEIRO = 1.0

// PRODUÇÃO — N (kg/ha/ano), Tabela 7.
export const productionN: FaixaDose[] = [
  fx(0, 20, 200), fx(20.1, 30, 260), fx(30.1, 50, 320), fx(50.1, 70, 380),
  fx(70.1, 100, 440), fx(100.1, 130, 500), fx(130.1, 170, 560), fx(170.1, MAX, 620),
]

const k2o = (...d: number[]): FaixaDose[] => [
  fx(0, 20, d[0]), fx(20.1, 30, d[1]), fx(30.1, 50, d[2]), fx(50.1, 70, d[3]),
  fx(70.1, 100, d[4]), fx(100.1, 130, d[5]), fx(130.1, 170, d[6]), fx(170.1, MAX, d[7]),
]
export const productionK2O_KLess60 = k2o(170, 230, 290, 350, 410, 470, 530, 600)
export const productionK2O_K60To120 = k2o(100, 160, 220, 280, 340, 400, 460, 520)
export const productionK2O_K120To200 = k2o(30, 90, 150, 210, 270, 330, 390, 450)
export const productionK2O_KMore200 = k2o(0, 0, 0, 80, 140, 200, 260, 320)

export function productionK2OTable(kSoil: number): FaixaDose[] {
  if (kSoil < 60) return productionK2O_KLess60
  if (kSoil <= 120) return productionK2O_K60To120
  if (kSoil <= 200) return productionK2O_K120To200
  return productionK2O_KMore200
}

/** Classes de P (Mehlich-1) por P-rem, Tabela 8; o vão fica com a classe de menor teor. */
export function phosphorusClass(pMehlich: number, pRemInformed: number): PhosphorusClass {
  const pRem = pRemInformed <= 0 ? P_REM_ASSUMED : pRemInformed
  const [muitoBaixo, baixo, medio] = pRem < 20 ? [3, 7, 11] : pRem <= 40 ? [5, 11, 21] : [10, 21, 31]
  if (pMehlich < muitoBaixo) return 'VERY_LOW'
  if (pMehlich < baixo) return 'LOW'
  if (pMehlich < medio) return 'MEDIUM'
  return 'HIGH'
}

function p2o5Table(...doses: number[]): FaixaDose[] {
  const limites = [20, 30, 50, 70, 100, 130, 170]
  const faixas: FaixaDose[] = []
  let min = 0
  limites.forEach((max, i) => {
    faixas.push(fx(min, max, doses[i]))
    min = max + 0.1
  })
  faixas.push(fx(min, MAX, doses[limites.length]))
  return faixas
}
const productionP2O5: Record<PhosphorusClass, FaixaDose[]> = {
  VERY_LOW: p2o5Table(30, 45, 60, 75, 90, 105, 120, 140),
  LOW: p2o5Table(20, 35, 45, 60, 75, 90, 105, 120),
  MEDIUM: p2o5Table(0, 0, 0, 20, 35, 50, 65, 80),
  HIGH: p2o5Table(0, 0, 0, 0, 0, 20, 40, 60),
}
export const productionP2O5Table = (cls: PhosphorusClass): FaixaDose[] => productionP2O5[cls]

/** Micros (Tabela 4): baixo = abaixo do 1º limite; médio até o 2º (inclusive). */
export function micronutrientStatus(value: number, nutrient: string): NutritionalStatus {
  const limits: Record<string, [number, number]> = {
    B: [0.2, 0.6], CU: [0.5, 1.5], FE: [20, 30], MN: [5, 15], ZN: [2, 6],
  }
  const l = limits[nutrient.toUpperCase()]
  if (!l) return 'GOOD'
  if (value < l[0]) return 'LOW'
  if (value <= l[1]) return 'MEDIUM'
  return 'GOOD'
}

export const sulfurStatus = (s: number): NutritionalStatus => (s < 5 ? 'LOW' : s <= 10 ? 'MEDIUM' : 'GOOD')
export const calciumStatus = (c: number): NutritionalStatus => (c < 1.5 ? 'LOW' : c <= 4 ? 'MEDIUM' : 'GOOD')
export const magnesiumStatus = (m: number): NutritionalStatus => (m < 0.5 ? 'LOW' : m <= 1 ? 'MEDIUM' : 'GOOD')

// pH: diagnóstico, não dose
export const PH_MUITO_ACIDO = 5.0
export const PH_ACIDO = 5.5
export const PH_ADEQUADO = 6.5
export const PH_NEUTRO_ALTO = 7.0
export const PH_CATION_BLOQUEIO = 6.5
export const PH_B_E_P_ALTO = 7.0

// Crédito de N pela MO — valor de referência do app, desligado por padrão.
export const MO_N_KG_PER_HA_PERCENT = 5.0
export const MO_N_MAX_FRACTION = 0.2

// Calagem e gessagem
export const CA_MIN_AFTER_LIMING = 2.5
export const MG_MIN_AFTER_LIMING = 1.0
export const LIME_MAX_SINGLE_APPLICATION_T_HA = 3.0
export const CA_MG_SUM_MIN_AFTER_LIMING = CA_MIN_AFTER_LIMING + MG_MIN_AFTER_LIMING
export const CA_MG_RATIO_MAX = 4.0
export const MIN_SPLITS = 3
export const V2_STANDARD = 60.0
export const HIGH_YIELD_SC_HA = 100.0
export const V2_YIELD_THRESHOLD_SC_HA = 60.0
export const V2_CTC_MEDIUM_MAX = 8.6
export const V2_CTC_LOW_MAX = 4.3

export function v2ByCtc(ctc: number): number {
  if (ctc <= 0) return V2_STANDARD
  if (ctc < V2_CTC_LOW_MAX) return 80.0
  if (ctc <= V2_CTC_MEDIUM_MAX) return 70.0
  return V2_STANDARD
}
export const v2ByYield = (y: number): number => (y > V2_YIELD_THRESHOLD_SC_HA ? 70.0 : V2_STANDARD)

export const GYPSUM_FRACTION_OF_LIME = 0.3
export const GYPSUM_CA_MAX = 0.4
export const GYPSUM_AL_MIN = 0.5
export const GYPSUM_M_MAX = 30.0
