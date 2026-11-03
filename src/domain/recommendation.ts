/** Recomendação unificada — porte de `Recommendation.kt`. */
import { type SoilSample, isFormation } from './model'
import * as C from './calculator'
import { FORMATION_SPLITS, MIN_SPLITS } from './tables'

export interface Recommendation {
  sample: SoilSample
  liming: C.LimingResult
  limeType: C.LimeTypeRecommendation
  gypsum: C.GypsumResult
  calciumMagnesium: C.CalciumMagnesiumResult
  npk: C.NpkResult
  sulfur: C.SulfurResult
  micronutrients: C.MicronutrientItem[]
  phDiagnosis: C.PhDiagnosis
  organicMatterN: C.OrganicMatterNitrogen
  commercial: C.CommercialFertilizerResult
}

export interface RecommendationOptions {
  chosenProducts?: C.ChosenProduct[]
  /** null = V2 automático pela CTC e pela meta. */
  vDesired?: number | null
  prnt?: number
  useOrganicMatterCredit?: boolean
  /** Padrão pelo estágio: só o plantio incorpora. */
  limeApplication?: C.LimeApplication
  alreadyApplied?: Record<string, number>
}

export function recommend(sample: SoilSample, o: RecommendationOptions = {}): Recommendation {
  const chosen = o.chosenProducts ?? []
  const vDesired = o.vDesired ?? null
  const prnt = o.prnt ?? 80.0
  const useOm = o.useOrganicMatterCredit ?? false
  const app = o.limeApplication ?? C.limeApplicationDefaultFor(sample.stage)

  const liming = C.calculateLiming(sample, vDesired, prnt, app)
  const gypsum = C.calculateGypsum(sample, liming)
  const npk = C.calculateNpk(sample, useOm)
  const sulfur = C.calculateSulfur(sample)
  const micros = C.calculateMicronutrients(sample)
  const calciumMagnesium = C.calculateCalciumMagnesium(sample, liming, gypsum)
  const limeType = C.chooseLimeType(sample, liming)
  const phDiagnosis = C.analyzePh(sample, liming)
  const organicMatterN = npk.organicMatterN ??
    C.applyOrganicMatterCredit(npk.nKgPerHa, sample.organicMatter, useOm && !isFormation(sample.stage))
  // Incaper: no mínimo 3 parcelas de N e K; formação sempre 3 (Tabela 6).
  const splits = isFormation(sample.stage) ? FORMATION_SPLITS : Math.max(MIN_SPLITS, sample.numSplits)

  return {
    sample: { ...sample, numSplits: splits },
    liming, limeType, gypsum, calciumMagnesium, npk, sulfur,
    micronutrients: micros, phDiagnosis, organicMatterN,
    commercial: C.calculateCommercialDoses(npk, sulfur, micros, chosen, splits, o.alreadyApplied ?? {}),
  }
}
