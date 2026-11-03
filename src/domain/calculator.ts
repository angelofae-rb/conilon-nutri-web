/**
 * Núcleo agronômico — porte fiel de `FertilizerCalculator.kt` (app Android).
 * Os textos e números precisam sair idênticos aos do Kotlin: `golden.test.ts` confere.
 */
import { f0, f1 } from './format'
import {
  type NutritionalStatus, type SoilSample, type Stage,
  formationYear, hasAnySubsoilData, hasSubsoilLayer, isFormation, isPlanting,
} from './model'
import * as T from './tables'
import type { PhosphorusClass } from './tables'

// ---------- Tipos de resultado ----------
export type LimeApplication = 'SURFACE' | 'INCORPORATED_20' | 'INCORPORATED_30'
export const LIME_FACTOR: Record<LimeApplication, number> = { SURFACE: 0.5, INCORPORATED_20: 1.0, INCORPORATED_30: 1.5 }
export const LIME_APPLICATION_LABEL: Record<LimeApplication, string> = {
  SURFACE: 'Em superfície (sem incorporar)',
  INCORPORATED_20: 'Incorporado a 20 cm',
  INCORPORATED_30: 'Incorporado a 30 cm',
}
/** Só no plantio o calcário é incorporado; lavoura plantada e produção recebem em superfície. */
export const limeApplicationDefaultFor = (stage: Stage): LimeApplication =>
  stage === 'PLANTING' ? 'INCORPORATED_20' : 'SURFACE'

export interface LimingResult {
  sb: number; ctc: number; vCurrent: number; vDesired: number
  needLimeTonsPerHa: number; needLimeGramsPerPlant: number; needed: boolean
  prnt: number; application: LimeApplication; depthFactor: number
  needLimeTonsPerHaFullDepth: number; v2Reason: string; v2Automatic: boolean
}
export const exceedsSingleApplication = (l: LimingResult): boolean =>
  l.needLimeTonsPerHa > T.LIME_MAX_SINGLE_APPLICATION_T_HA

export type LimeType = 'CALCITICO' | 'DOLOMITICO'
export interface LimeTypeRecommendation {
  needed: boolean; type: LimeType | null; reason: string; productTonsPerHa: number
  prnt: number; howToApply: string; notes: string[]
}

export type PhBand = 'MUITO_ACIDO' | 'ACIDO' | 'ADEQUADO' | 'NEUTRO_ALTO' | 'ALCALINO'
export interface PhBlockage { symbol: string; label: string; action: string }
export interface PhDiagnosis {
  ph: number; band: PhBand; bandLabel: string; summary: string
  blocked: PhBlockage[]; inconsistency: string | null; phosphorusFixationWarning: string | null
}

export interface OrganicMatterNitrogen {
  baseKgPerHa: number; creditKgPerHa: number; finalKgPerHa: number
  moPercent: number; enabled: boolean; note: string
}

export interface GypsumResult {
  indicated: boolean; reason: string; doseKgPerHa: number; doseGramsPerPlant: number
  preliminary: boolean; applicationNote: string; subsoilInformed: boolean; possibleBySurface: boolean
}

export interface NpkResult {
  plantsPerHa: number
  nKgPerHa: number; p2o5KgPerHa: number; k2oKgPerHa: number
  nGramsPerPlant: number; p2o5GramsPerPlant: number; k2oGramsPerPlant: number
  nGramsPerPlantPerSplit: number; k2oGramsPerPlantPerSplit: number
  phosphorusStatus: NutritionalStatus; phosphorusClass: PhosphorusClass
  nKgPerHaBase: number; organicMatterN: OrganicMatterNitrogen | null; p2o5Note: string | null
}

export interface SulfurResult { status: NutritionalStatus; recommendationKgPerHa: number; note: string; informed: boolean }

export interface CalciumMagnesiumResult {
  calciumStatus: NutritionalStatus; magnesiumStatus: NutritionalStatus
  coveredByLimingOrGypsum: boolean; mgRecommendationKgPerHa: number
  mgRecommendationGramsPerPlant: number; note: string
}

export interface MicronutrientItem {
  nutrient: string; value: number; status: NutritionalStatus; recommendation: string
  recKgHa: number | null; recGramsPerPlant: number | null
}
/** "Boro (B)" -> "B". */
export const microSymbol = (m: { nutrient: string }): string => {
  const r = /\((.*?)\)/.exec(m.nutrient)
  return (r ? r[1] : m.nutrient).toUpperCase()
}

export interface AppliedProduct {
  name: string; kgPerHa: number; gramsPerPlant: number; gramsPerPlantPerSplit: number | null
  mainNutrient: string; bagWeightKg: number; bagPrice: number
}
export interface CommercialFertilizerResult { products: AppliedProduct[] }

/** [nome, garantias (%) + bagWeightKg/pricePerBag, alvo] — mesmo formato do Kotlin. */
export type ChosenProduct = [string, Record<string, number>, string]

// ---------- Cálculo ----------
export function plantsPerHa(rowSpacing: number, plantSpacing: number): number {
  return rowSpacing > 0 && plantSpacing > 0 ? Math.trunc(10000 / (rowSpacing * plantSpacing)) : 0
}

/** QC = T (V2 − V1) ÷ PRNT × p. `vDesired` nulo = V2 automático (CTC e meta). */
export function calculateLiming(
  sample: SoilSample,
  vDesired: number | null = null,
  prnt = 80.0,
  application: LimeApplication = 'INCORPORATED_20',
): LimingResult {
  const kCmolc = sample.k / 391.0
  const sb = sample.ca + sample.mg + kCmolc
  const ctc = sb + sample.hAl
  const vCurrent = ctc > 0 ? (sb / ctc) * 100.0 : 0.0

  const yieldForV2 = isFormation(sample.stage) ? null : sample.expectedYield
  const v2c = T.v2ByCtc(ctc)
  const v2y = yieldForV2 !== null ? T.v2ByYield(yieldForV2) : 0.0
  const v2Auto = Math.max(v2c, v2y)
  const target = vDesired ?? v2Auto
  const v2Reason = vDesired !== null
    ? 'V2 de ' + f0(target) + '% definido por você.'
    : 'V2 de ' + f0(target) + '%: CTC de ' + f1(ctc) + ' cmolc/dm³ pede ' + f0(v2c) +
      '% (Paye et al., Incaper)' +
      (yieldForV2 !== null && v2y > T.V2_STANDARD
        ? '; a meta de ' + f0(yieldForV2) + ' sc/ha pede ' + f0(v2y) +
          '% (Incaper 2019: 70 a 75% acima de 60 sc/ha)'
        : '') + '.'

  const prntSafe = Math.max(prnt, 1.0)
  let fullDepth = 0.0
  if (vCurrent < target && ctc > 0) fullDepth = ((target - vCurrent) * ctc) / prntSafe
  fullDepth = Math.max(0.0, fullDepth)
  const factor = LIME_FACTOR[application]
  const tons = fullDepth * factor
  const plants = plantsPerHa(sample.rowSpacing, sample.plantSpacing)
  const gPerPlant = plants > 0 ? (tons * 1_000_000.0) / plants : 0.0

  return {
    sb, ctc, vCurrent, vDesired: target,
    needLimeTonsPerHa: tons, needLimeGramsPerPlant: gPerPlant, needed: tons > 0.0,
    prnt: prntSafe, application, depthFactor: factor,
    needLimeTonsPerHaFullDepth: fullDepth, v2Reason, v2Automatic: vDesired === null,
  }
}

export function chooseLimeType(sample: SoilSample, liming: LimingResult): LimeTypeRecommendation {
  const tonnage = liming.needLimeTonsPerHa
  const prnt = liming.prnt
  const formula = 'Se o PRNT do rótulo for diferente de ' + f0(prnt) +
    '%: t a aplicar = ' + (tonnage > 0 ? f1(tonnage) : 'dose') +
    ' × ' + f0(prnt) + ' ÷ PRNT do rótulo'
  const notes = limeNotes(sample, liming)

  if (!liming.needed) {
    return {
      needed: false, type: null,
      reason: 'Sem necessidade de calcário neste ciclo pela saturação por bases.',
      productTonsPerHa: 0.0, prnt, howToApply: 'Nada a comprar.', notes,
    }
  }

  const mgStatus = T.magnesiumStatus(sample.mg)
  const caStatus = T.calciumStatus(sample.ca)
  const caMgRatio = sample.ca > 0 && sample.mg > 0 ? sample.ca / sample.mg : null
  const ratioHigh = caMgRatio !== null && caMgRatio > T.CA_MG_RATIO_MAX

  const useDolomite = ratioHigh || (
    mgStatus === 'LOW' ? true : mgStatus === 'MEDIUM' ? caStatus === 'GOOD' : false
  )
  const type: LimeType = useDolomite ? 'DOLOMITICO' : 'CALCITICO'
  let reason: string
  if (type === 'DOLOMITICO') {
    if (ratioHigh && mgStatus !== 'LOW') {
      reason = 'Relação Ca:Mg de ' + f1(caMgRatio as number) + ':1, acima de 4:1 (Incaper 2019): ' +
        'use calcário DOLOMÍTICO para trazer o Mg junto com o Ca.'
    } else if (mgStatus === 'LOW') {
      reason = 'Mg baixo (' + f1(sample.mg) + ' cmolc/dm³): use calcário DOLOMÍTICO, ' +
        'que corrige a acidez e repõe Mg na mesma operação.'
    } else {
      reason = 'Mg médio com Ca adequado: DOLOMÍTICO completa o Mg e evita ' +
        'uma aplicação separada de sulfato de magnésio.'
    }
  } else {
    reason = 'Mg adequado e relação Ca:Mg dentro de 4:1: CALCÍTICO é suficiente e mais barato. ' +
      'Dolomítico só adicionaria custo sem corrigir nada.'
  }

  return {
    needed: true, type, reason, productTonsPerHa: tonnage, prnt,
    howToApply: tonnage > 0
      ? 'Aplicar ' + f1(tonnage) + ' t/ha de calcário com PRNT ' + f0(prnt) + '%. ' + formula + '.'
      : formula,
    notes,
  }
}

function limeNotes(sample: SoilSample, liming: LimingResult): string[] {
  const notes: string[] = []
  if (liming.needed && exceedsSingleApplication(liming)) {
    notes.push('Dose acima de ' + f0(T.LIME_MAX_SINGLE_APPLICATION_T_HA) +
      ' t/ha: divida em duas aplicações, com intervalo mínimo de 6 meses ' +
      '(máximo de 3 t/ha por aplicação em cultura perene). É referência do app: o ' +
      'capítulo 14 do Incaper 2019 e o DOC 316 não trazem esse teto.')
  }
  if (sample.ca > 0 && sample.ca < T.CA_MIN_AFTER_LIMING) {
    notes.push('Ca de ' + f1(sample.ca) + ' cmolc/dm³ está abaixo do mínimo de ' +
      f1(T.CA_MIN_AFTER_LIMING) + ' que a calagem deve garantir (Incaper 2019).')
  }
  if (sample.mg > 0 && sample.mg < T.MG_MIN_AFTER_LIMING) {
    notes.push('Mg de ' + f1(sample.mg) + ' cmolc/dm³ está abaixo do mínimo de ' +
      f1(T.MG_MIN_AFTER_LIMING) + ' que a calagem deve garantir (Incaper 2019).')
  }
  if (liming.needed && liming.ctc > 0) {
    const sbAfter = Math.max(liming.sb, (liming.vDesired / 100.0) * liming.ctc)
    const caMgAfter = Math.max(sample.ca + sample.mg, sbAfter - sample.k / 391.0)
    if (caMgAfter < T.CA_MG_SUM_MIN_AFTER_LIMING) {
      notes.push('Estimativa: depois da calagem Ca + Mg ficam em ' + f1(caMgAfter) +
        ' cmolc/dm³, abaixo da soma dos mínimos do Incaper (Ca 2,5 + Mg 1,0 = ' +
        f1(T.CA_MG_SUM_MIN_AFTER_LIMING) + '). O V% sozinho pode não ' +
        'garantir os mínimos: confira na análise seguinte.')
    }
  }
  if (!isFormation(sample.stage) && sample.expectedYield >= T.HIGH_YIELD_SC_HA && liming.vDesired < 75.0) {
    notes.push('Meta de ' + f0(sample.expectedYield) + ' sc/ha: o Incaper 2019 cita V2 de ' +
      '70 a 75% para lavouras que chegam a 150 sc/ha. O cálculo usa V2 de ' +
      f0(liming.vDesired) + '%; a ponta alta da faixa (75%) é decisão do técnico.')
  }
  return notes
}

export function analyzePh(sample: SoilSample, liming: LimingResult): PhDiagnosis {
  const ph = sample.ph
  const band: PhBand = ph < T.PH_MUITO_ACIDO ? 'MUITO_ACIDO'
    : ph < T.PH_ACIDO ? 'ACIDO'
      : ph <= T.PH_ADEQUADO ? 'ADEQUADO'
        : ph <= T.PH_NEUTRO_ALTO ? 'NEUTRO_ALTO' : 'ALCALINO'
  const bandLabel = {
    MUITO_ACIDO: 'Muito ácido', ACIDO: 'Ácido', ADEQUADO: 'Adequado para café',
    NEUTRO_ALTO: 'Neutro a alto', ALCALINO: 'Alcalino',
  }[band]
  const summary = {
    MUITO_ACIDO: 'pH ' + f1(ph) + ' está muito baixo para café: Al e H tendem a dominar a CTC, ' +
      'e P, Ca, Mg, Mo e B ficam menos disponíveis. Tratar a acidez vem antes ' +
      'de discutir N, P e K.',
    ACIDO: 'pH ' + f1(ph) + ' é ácido. A calagem por V% indicada abaixo resolve a acidez; ' +
      'a partir daí a disponibilidade de P, Ca, Mg e B melhora sozinha.',
    ADEQUADO: 'pH ' + f1(ph) + ' está na faixa boa para café. Não é o limite da produtividade ' +
      'aqui: olhe V%, P e K.',
    NEUTRO_ALTO: 'pH ' + f1(ph) + ' já está alto. A partir daqui Fe, Mn e Zn tendem a perder ' +
      'disponibilidade, e repetir a calagem pode agravar.',
    ALCALINO: 'pH ' + f1(ph) + ' é alcalino para café: risco de deficiência de Fe, Mn, Zn e B, ' +
      'e de fixação de P. Não aplique mais calcário. Se a V% estiver baixa, ' +
      'a prioridade passa a ser o manejo do solo, não a dose.',
  }[band]

  const blocked: PhBlockage[] = []
  if (ph >= T.PH_CATION_BLOQUEIO) {
    const list: [string, string, number][] = [
      ['FE', 'Ferro (Fe)', sample.fe], ['MN', 'Manganês (Mn)', sample.mn], ['ZN', 'Zinco (Zn)', sample.zn],
    ]
    for (const [key, microLabel, value] of list) {
      if (value > 0 && T.micronutrientStatus(value, key) === 'LOW') {
        const symbol = microLabel.slice(microLabel.indexOf('(') + 1, -1)
        blocked.push({
          symbol, label: microLabel,
          action: 'Teor baixo com pH alto: a causa provável é o pH, não a falta ' +
            'de ' + symbol + '. Mais adubo no solo precipita de novo: priorize ' +
            'quelato, aplicação foliar ou redução da acidez.',
        })
      }
    }
    if (sample.b > 0 && T.micronutrientStatus(sample.b, 'B') === 'LOW' && ph >= T.PH_B_E_P_ALTO) {
      blocked.push({
        symbol: 'B', label: 'Boro (B)',
        action: 'Teor baixo com pH acima de 7: o Boro perde disponibilidade. ' +
          'Confirme com análise foliar antes de Borax, porque a faixa de dose ' +
          'no solo é estreita.',
      })
    }
  }

  const pWarning = ph >= T.PH_B_E_P_ALTO
    ? 'pH ' + f1(ph) + ': o fósforo pode estar sendo fixado como fosfato de cálcio. ' +
      'Se a análise de solo vier baixa, a análise de folha é mais confiável para ' +
      'decidir P, e parcelar a aplicação ajuda.'
    : null

  let inconsistency: string | null = null
  if (ph >= T.PH_ADEQUADO && liming.vCurrent < 40.0) {
    inconsistency = 'pH ' + f1(ph) + ' alto com V% de apenas ' + f0(liming.vCurrent) + '%: os dois ' +
      'indicadores apontando para sentidos opostos. Revise se a calagem usa o ' +
      'mesmo solo e a mesma profundidade de amostra, ou peça nova análise.'
  } else if (ph < T.PH_ACIDO && liming.vCurrent >= 60.0) {
    inconsistency = 'pH ' + f1(ph) + ' ácido com V% de ' + f0(liming.vCurrent) + '%: também ' +
      'contraditório. A calagem segue pela V%, que é o critério oficial, mas vale ' +
      'confirmar o pH do laudo.'
  }

  return { ph, band, bandLabel, summary, blocked, inconsistency, phosphorusFixationWarning: pWarning }
}

export function applyOrganicMatterCredit(baseKgPerHa: number, organicMatterPercent: number, enabled = true): OrganicMatterNitrogen {
  if (!enabled || organicMatterPercent <= 0) {
    return {
      baseKgPerHa, creditKgPerHa: 0.0, finalKgPerHa: baseKgPerHa, moPercent: organicMatterPercent, enabled,
      note: enabled ? 'MO não informada: dose de N sem desconto.'
        : 'Desconto por MO desligado: dose de N conforme o Incaper (2019).',
    }
  }
  const raw = organicMatterPercent * T.MO_N_KG_PER_HA_PERCENT
  const cap = baseKgPerHa * T.MO_N_MAX_FRACTION
  const credit = Math.min(raw, cap)
  const limited = raw > cap
  const final = baseKgPerHa - credit
  let note = 'MO de ' + f1(organicMatterPercent) + '% credita ' + f0(credit) + ' kg N/ha (' +
    f1(T.MO_N_KG_PER_HA_PERCENT) + ' kg por ponto de MO). '
  if (limited) {
    note += 'O crédito foi limitado a ' + f0(cap) +
      ' kg (20% da dose oficial) para não afastar a recomendação do manual. '
  }
  note += 'Dose final: ' + f0(final) + ' kg N/ha. ' +
    'Valor de referência do app, não tabela do Incaper: desligue para seguir o manual puro.'
  return { baseKgPerHa, creditKgPerHa: credit, finalKgPerHa: final, moPercent: organicMatterPercent, enabled, note }
}

export function calculateGypsum(sample: SoilSample, liming: LimingResult | null = null): GypsumResult {
  if (!hasSubsoilLayer(sample)) return gypsumWithoutSubsoil(sample)

  const sb = sample.subCa + sample.subMg + sample.subK / 391.0
  const ctcSub = sb + sample.subHAl
  const vSub = ctcSub > 0 ? (sb / ctcSub) * 100.0 : 0.0
  const effectiveCtc = sb + sample.subAl
  const alSaturation = effectiveCtc > 0 ? (sample.subAl / effectiveCtc) * 100.0 : 0.0

  const byCa = sample.subCa > 0 && sample.subCa <= T.GYPSUM_CA_MAX
  const byAl = sample.subAl >= T.GYPSUM_AL_MIN
  const byM = alSaturation > T.GYPSUM_M_MAX
  if (!(byCa || byAl || byM)) {
    return {
      indicated: false,
      reason: 'Camada de 20 a 40 cm: Ca, Al e saturação por Al dentro do aceitável — gesso não indicado.',
      doseKgPerHa: 0.0, doseGramsPerPlant: 0.0, preliminary: false, applicationNote: '',
      subsoilInformed: true, possibleBySurface: false,
    }
  }

  const base = liming ?? calculateLiming(sample)
  const qcSub = Math.max(0.0, ((base.vDesired - vSub) * ctcSub) / base.prnt)
  const doseKg = T.GYPSUM_FRACTION_OF_LIME * qcSub * 1000.0
  const plants = plantsPerHa(sample.rowSpacing, sample.plantSpacing)
  const gPerPlant = plants > 0 ? (doseKg * 1000.0) / plants : 0.0

  const criterios: string[] = []
  if (byCa) criterios.push('Ca de ' + f1(sample.subCa) + ' (≤ 0,4 cmolc/dm³)')
  if (byAl) criterios.push('Al de ' + f1(sample.subAl) + ' (≥ 0,5 cmolc/dm³)')
  if (byM) criterios.push('saturação por Al de ' + f0(alSaturation) + '% (> 30%)')

  let motivo = 'Camada de 20 a 40 cm — indicado: ' + criterios.join(', ') + '. '
  if (doseKg > 0) {
    motivo += 'Dose = 30% do calcário dessa camada (' + f1(qcSub) + ' t/ha, V ' + f0(vSub) + '% → ' +
      f0(base.vDesired) + '%) = ' + f0(doseKg) + ' kg/ha.'
  } else {
    motivo += 'O calcário dessa camada dá zero (V% já atingida), então a fórmula do ' +
      'Incaper (30% do calcário) também dá zero.'
  }

  return {
    indicated: true, reason: motivo, doseKgPerHa: doseKg, doseGramsPerPlant: gPerPlant, preliminary: false,
    applicationNote: 'Aplicar em superfície, sem incorporar. Prática de campo, não ' +
      'consta no Incaper: deixar uns 3 meses depois da calagem. O gesso não corrige ' +
      'o pH nem substitui o calcário.',
    subsoilInformed: true, possibleBySurface: false,
  }
}

function gypsumWithoutSubsoil(sample: SoilSample): GypsumResult {
  const sb = sample.ca + sample.mg + sample.k / 391.0
  const effectiveCtc = sb + sample.al
  const alSaturation = effectiveCtc > 0 ? (sample.al / effectiveCtc) * 100.0 : 0.0
  const possible = (sample.ca > 0 && sample.ca <= T.GYPSUM_CA_MAX) ||
    sample.al >= T.GYPSUM_AL_MIN || alSaturation > T.GYPSUM_M_MAX
  let motivo = hasAnySubsoilData(sample)
    ? 'Camada de 20 a 40 cm incompleta: informe H+Al e Ca ou Mg dessa camada. '
    : 'Sem análise da camada de 20 a 40 cm. '
  motivo += 'O Incaper decide a gessagem nessa camada, por isso o app não calcula dose ' +
    'com o laudo de 0 a 20 cm.'
  if (possible) {
    motivo += ' O seu laudo de superfície tem Ca baixo, Al alto ou m% alto: em solo ácido ' +
      'na superfície o remédio é o calcário. Se o subsolo também for pobre em Ca ' +
      'ou tiver Al tóxico, o gesso entra; informe a camada de 20 a 40 cm para calcular.'
  }
  return {
    indicated: false, reason: motivo, doseKgPerHa: 0.0, doseGramsPerPlant: 0.0, preliminary: true,
    applicationNote: '', subsoilInformed: false, possibleBySurface: possible,
  }
}

export function calculateNpk(sample: SoilSample, useOrganicMatterCredit = false): NpkResult {
  const plants = plantsPerHa(sample.rowSpacing, sample.plantSpacing)
  const pClass = T.phosphorusClass(sample.pMehlich, sample.pRem)
  const base = isFormation(sample.stage) ? formationNpk(sample, plants, pClass) : productionNpk(sample, plants, pClass)

  if (!useOrganicMatterCredit || isFormation(sample.stage)) return base

  const om = applyOrganicMatterCredit(base.nKgPerHa, sample.organicMatter, true)
  if (om.creditKgPerHa <= 0) return { ...base, nKgPerHaBase: base.nKgPerHa, organicMatterN: om }

  const nGrams = plants > 0 ? (om.finalKgPerHa * 1000.0) / plants : 0.0
  const splits = Math.max(T.MIN_SPLITS, sample.numSplits)
  return {
    ...base,
    nKgPerHa: om.finalKgPerHa, nKgPerHaBase: base.nKgPerHa,
    nGramsPerPlant: nGrams, nGramsPerPlantPerSplit: nGrams / splits, organicMatterN: om,
  }
}

function formationNpk(sample: SoilSample, plants: number, pClass: PhosphorusClass): NpkResult {
  const year = formationYear(sample.stage)
  const plantingClass = T.plantingPhosphorusClass(sample.pMehlich, sample.pRem)
  const p2o5PerPlant = isPlanting(sample.stage) ? T.formationP2O5GramsPerPlant(plantingClass) : 0.0
  let p2o5Note: string
  if (isPlanting(sample.stage)) {
    p2o5Note = 'P₂O₅ de plantio do Incaper 2019 (Tabela 5), classe de P ' +
      T.P_CLASS_LABEL[plantingClass].toLowerCase() +
      ': ' + f0(p2o5PerPlant) + ' g por cova de 40 × 40 × 40 cm (em sulco: ' +
      f0(T.furrowP2O5GramsPerMeter(plantingClass)) + ' g por metro). É dose de plantio, ' +
      'aplicada uma vez. Os limites das classes da Tabela 5 foram lidos por extração ' +
      'automática de texto; confirme com seu técnico.'
  } else if (year === 1) {
    p2o5Note = 'Lavoura já plantada: o Incaper 2019 só traz P₂O₅ no plantio (cova ou sulco), então não há dose ' +
      'aqui. Se ainda não plantou, escolha o estágio Plantio.'
  } else {
    p2o5Note = 'O Incaper 2019 não traz P₂O₅ para o 2º ano de formação e o app não recomenda dose. ' +
      'Decida com o técnico, com a análise de solo em mãos.'
  }
  const nPerPlant = T.formationNitrogenDose(year)
  const k2oPerPlant = T.buscarDose(year === 1 ? T.formationK2OYear1 : T.formationK2OYear2, sample.k)
  const splits = T.FORMATION_SPLITS
  const nKgHa = plants > 0 ? (nPerPlant * plants) / 1000.0 : 0.0
  const pKgHa = plants > 0 ? (p2o5PerPlant * plants) / 1000.0 : 0.0
  const kKgHa = plants > 0 ? (k2oPerPlant * plants) / 1000.0 : 0.0
  return {
    plantsPerHa: plants,
    nKgPerHa: nKgHa, p2o5KgPerHa: pKgHa, k2oKgPerHa: kKgHa,
    nGramsPerPlant: nPerPlant, p2o5GramsPerPlant: p2o5PerPlant, k2oGramsPerPlant: k2oPerPlant,
    nGramsPerPlantPerSplit: nPerPlant / splits, k2oGramsPerPlantPerSplit: k2oPerPlant / splits,
    phosphorusStatus: T.P_CLASS_STATUS[pClass], phosphorusClass: pClass,
    nKgPerHaBase: 0.0, organicMatterN: null, p2o5Note,
  }
}

function productionNpk(sample: SoilSample, plants: number, pClass: PhosphorusClass): NpkResult {
  const y = sample.expectedYield
  const nKg = T.buscarDose(T.productionN, y)
  const p2o5Kg = T.buscarDose(T.productionP2O5Table(pClass), y)
  const k2oKg = T.buscarDose(T.productionK2OTable(sample.k), y)
  const nG = plants > 0 ? (nKg * 1000.0) / plants : 0.0
  const pG = plants > 0 ? (p2o5Kg * 1000.0) / plants : 0.0
  const kG = plants > 0 ? (k2oKg * 1000.0) / plants : 0.0
  const splits = Math.max(T.MIN_SPLITS, sample.numSplits)
  return {
    plantsPerHa: plants,
    nKgPerHa: nKg, p2o5KgPerHa: p2o5Kg, k2oKgPerHa: k2oKg,
    nGramsPerPlant: nG, p2o5GramsPerPlant: pG, k2oGramsPerPlant: kG,
    nGramsPerPlantPerSplit: nG / splits, k2oGramsPerPlantPerSplit: kG / splits,
    phosphorusStatus: T.P_CLASS_STATUS[pClass], phosphorusClass: pClass,
    nKgPerHaBase: 0.0, organicMatterN: null, p2o5Note: null,
  }
}

export function calculateSulfur(sample: SoilSample): SulfurResult {
  if (sample.sulfur <= 0) {
    return {
      status: 'MEDIUM', recommendationKgPerHa: 0.0,
      note: 'S-SO₄ não informado no laudo: sem recomendação de enxofre. ' +
        'Informe o valor da análise para calcular.',
      informed: false,
    }
  }
  const status = T.sulfurStatus(sample.sulfur)
  if (status === 'LOW') {
    return { status, recommendationKgPerHa: 40.0, informed: true,
      note: 'Teor baixo: repor ~40 kg S/ha (valor de referência do app; o Incaper não traz dose de S). Pode ser suprido via Sulfato de Amônio ou Superfosfato Simples.' }
  }
  if (status === 'MEDIUM') {
    return { status, recommendationKgPerHa: 20.0, informed: true,
      note: 'Teor médio: manutenção de ~20 kg S/ha (valor de referência do app, não do Incaper), geralmente coberta pela adubação NPK escolhida.' }
  }
  return { status, recommendationKgPerHa: 0.0, informed: true,
    note: 'Suprimento adequado — sem necessidade de aplicação específica de S.' }
}

export function calculateCalciumMagnesium(sample: SoilSample, liming: LimingResult, gypsum: GypsumResult): CalciumMagnesiumResult {
  const caStatus = T.calciumStatus(sample.ca)
  const mgStatus = T.magnesiumStatus(sample.mg)
  const covered = liming.needed || gypsum.indicated
  let mgKg = 0.0
  let note: string
  if (covered) {
    note = 'Calagem/gessagem já indicada neste ciclo: dê preferência a calcário ' +
      'dolomítico (rico em Mg) para corrigir Ca e Mg junto com a acidez.'
  } else if (mgStatus === 'LOW') {
    mgKg = 30.0
    note = 'Mg baixo no solo e sem indicação de calagem/gessagem neste ciclo: repor ' +
      'via calcário dolomítico ou sulfato de magnésio (~30 kg MgO/ha, valor de referência do app; o Incaper não traz dose de Mg).'
  } else if (caStatus === 'LOW') {
    note = 'Ca baixo no solo, mas fora do critério que indica gessagem/calagem automática ' +
      '— reavaliar na próxima amostragem.'
  } else {
    note = 'Suprimento de Ca e Mg adequado — sem necessidade de aplicação específica.'
  }
  const plants = plantsPerHa(sample.rowSpacing, sample.plantSpacing)
  return {
    calciumStatus: caStatus, magnesiumStatus: mgStatus, coveredByLimingOrGypsum: covered,
    mgRecommendationKgPerHa: mgKg, mgRecommendationGramsPerPlant: plants > 0 ? (mgKg * 1000.0) / plants : 0.0,
    note,
  }
}

interface MicroRec { text: string; kgHa: number | null; gramsPerPlant: number | null }
const rec = (text: string, kgHa: number | null = null, gramsPerPlant: number | null = null): MicroRec => ({ text, kgHa, gramsPerPlant })

export function calculateMicronutrients(sample: SoilSample): MicronutrientItem[] {
  const plants = plantsPerHa(sample.rowSpacing, sample.plantSpacing)
  const micros: [string, string, number][] = [
    ['B', 'Boro (B)', sample.b], ['CU', 'Cobre (Cu)', sample.cu], ['FE', 'Ferro (Fe)', sample.fe],
    ['MN', 'Manganês (Mn)', sample.mn], ['ZN', 'Zinco (Zn)', sample.zn],
  ]
  return micros
    .filter(([, , v]) => v > 0)
    .map(([key, label, value]) => {
      const status = T.micronutrientStatus(value, key)
      const r = isPlanting(sample.stage) ? plantingMicroRecommendation(key, value, plants)
        : isFormation(sample.stage) ? formationMicroRecommendation(status, key)
          : micronutrientRecommendation(status, key)
      return {
        nutrient: label, value, status, recommendation: r.text, recKgHa: r.kgHa,
        recGramsPerPlant: r.gramsPerPlant ?? (r.kgHa !== null && plants > 0 ? (r.kgHa * 1000.0) / plants : null),
      }
    })
}

function plantingMicroRecommendation(nutrient: string, value: number, plants: number): MicroRec {
  const porCova = (g: number): number | null => (plants > 0 ? (g * plants) / 1000.0 : null)
  switch (nutrient.toUpperCase()) {
    case 'ZN':
      return value < T.PLANTING_ZN_BELOW_MG_DM3
        ? rec('Aplicar ' + f1(T.PLANTING_ZN_G_PER_PIT) + ' g de zinco por cova de plantio ' +
            '(Incaper 2019: zinco abaixo de 6 mg/dm³).', porCova(T.PLANTING_ZN_G_PER_PIT), T.PLANTING_ZN_G_PER_PIT)
        : rec('Suprimento adequado para o plantio.')
    case 'B':
      return value < T.PLANTING_B_BELOW_MG_DM3
        ? rec('Aplicar ' + f0(T.PLANTING_B_G_PER_PIT) + ' g de boro por cova de plantio ' +
            '(Incaper 2019: boro abaixo de 0,6 mg/dm³). A faixa entre falta e excesso é estreita: ' +
            'não passe da dose e misture bem à terra.', porCova(T.PLANTING_B_G_PER_PIT), T.PLANTING_B_G_PER_PIT)
        : rec('Suprimento adequado para o plantio.')
    case 'MN':
      return rec('Só em solo de tabuleiro: ' + f0(T.PLANTING_MN_G_PER_PIT_TABULEIRO) +
        ' g de manganês por cova (Incaper 2019). Fora do tabuleiro, sem dose de plantio.')
    case 'FE':
      return rec('Só em solo de tabuleiro: ' + f0(T.PLANTING_FE_G_PER_PIT_TABULEIRO) +
        ' g de ferro por cova (Incaper 2019). Fora do tabuleiro, sem dose de plantio.')
    case 'CU':
      return rec('O Incaper 2019 não traz cobre para a cova de plantio.')
    default:
      return rec('Consultar manual técnico.')
  }
}

function formationMicroRecommendation(status: NutritionalStatus, nutrient: string): MicroRec {
  if (status === 'GOOD') return rec('Suprimento adequado.')
  const zincoFoliar = nutrient.toUpperCase() === 'ZN'
    ? ' A via de correção em lavoura plantada é foliar: sulfato de zinco a 0,3% (Incaper 2019).' : ''
  return rec('Sem dose de formação: o Incaper 2019 só traz micros na cova de plantio e, em produção, no ' +
    'início da floração.' + zincoFoliar + ' Com o teor fora do adequado, fale com seu técnico.')
}

function micronutrientRecommendation(status: NutritionalStatus, nutrient: string): MicroRec {
  if (status === 'GOOD') return rec('Suprimento adequado.')
  const low = status === 'LOW'
  const foliar = (produto: string): string => 'Também há a opção foliar: ' + produto + ' a 0,3%, em ' +
    'complemento na pré-florada, no chumbinho e na granação (Incaper 2019 e DOC 316).'
  switch (nutrient.toUpperCase()) {
    case 'B': {
      const dose = low ? 2.0 : 1.0
      return rec('Aplicar ' + f0(dose) + ' kg/ha de Boro no solo, no início da floração. ' +
        'A faixa entre falta e excesso é estreita: não passe da dose.', dose)
    }
    case 'ZN': {
      const dose = low ? 3.0 : 2.0
      return rec('Aplicar ' + f0(dose) + ' kg/ha de Zinco no solo, no início da floração. ' +
        foliar('sulfato de zinco') + ' Junte cloreto de potássio a 0,3% para ajudar a absorção.', dose)
    }
    case 'CU': {
      const dose = low ? 3.0 : 2.0
      return rec('Aplicar ' + f0(dose) + ' kg/ha de Cobre no solo, no início da floração. ' + foliar('sulfato de cobre'), dose)
    }
    case 'MN': {
      const dose = low ? 15.0 : 10.0
      return rec('Aplicar ' + f0(dose) + ' kg/ha de Manganês no solo, no início da floração. ' + foliar('sulfato manganoso'), dose)
    }
    case 'FE':
      return rec((low ? 'Ferro baixo' : 'Ferro médio') + ': o Incaper não traz dose de Fe no solo. ' +
        'Verifique antes o pH e o excesso de calcário (o Fe perde disponibilidade com pH alto); ' +
        'se precisar corrigir, a via é foliar: sulfato ferroso a 0,3% (0,2% de maio a agosto), ' +
        'conforme o Incaper 2019, cap. 14.')
    default:
      return rec('Consultar manual técnico.')
  }
}

const MICRO_TARGETS = new Set(['P', 'B', 'ZN', 'CU', 'MN', 'FE'])
const chaveDe = (n: string): string => (n === 'P' ? 'P2O5' : n === 'K' ? 'K2O' : n)

/**
 * Doses de adubo comercial. O formulado que entrega mais de um nutriente necessário é
 * calculado primeiro; o resto segue P → micros → K → S → N. O que um adubo entrega dos
 * outros nutrientes é descontado da necessidade deles.
 */
export function calculateCommercialDoses(
  npk: NpkResult,
  sulfur: SulfurResult,
  micros: MicronutrientItem[],
  chosenProducts: ChosenProduct[],
  numSplits: number,
  alreadyApplied: Record<string, number> = {},
): CommercialFertilizerResult {
  const splits = Math.max(T.MIN_SPLITS, numSplits)
  const plants = npk.plantsPerHa
  const applied: AppliedProduct[] = []

  // Map preserva a ordem de inserção, como o LinkedHashMap do Kotlin.
  const needs = new Map<string, number>([
    ['N', npk.nKgPerHa], ['P', npk.p2o5KgPerHa], ['K', npk.k2oKgPerHa], ['S', sulfur.recommendationKgPerHa],
  ])
  for (const m of micros) {
    const r = /\((.*?)\)/.exec(m.nutrient)
    const symbol = r ? r[1].toUpperCase() : ''
    if (symbol !== '' && m.recKgHa !== null) needs.set(symbol, m.recKgHa)
  }
  for (const [nutriente, feito] of Object.entries(alreadyApplied)) {
    const chave = nutriente.toUpperCase()
    const atual = needs.get(chave)
    if (atual !== undefined) needs.set(chave, Math.max(0.0, atual - feito))
  }

  const fornecePlural = (alvo: string): boolean => {
    const garantias = chosenProducts.find((c) => c[2] === alvo)?.[1]
    if (!garantias) return false
    let count = 0
    for (const [nutriente, falta] of needs) {
      if (falta > 0 && (garantias[chaveDe(nutriente)] ?? 0) > 0) count++
    }
    return count >= 2
  }
  const targetsOrder = ['P', 'B', 'ZN', 'CU', 'MN', 'FE', 'K', 'S', 'N']
    .map((t) => ({ t, k: fornecePlural(t) ? 0 : 1 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.t)

  for (const target of targetsOrder) {
    const productInfo = chosenProducts.find((c) => c[2] === target)
    if (!productInfo) continue
    const [name, nutrients] = productInfo
    const conc = (nutrients[chaveDe(target)] ?? 0) / 100.0
    const needed = needs.get(target) ?? 0
    if (conc > 0 && needed > 0) {
      const kgHa = needed / conc
      const gPlant = plants > 0 ? (kgHa * 1000.0) / plants : 0.0
      for (const nutrient of Array.from(needs.keys())) {
        const discountConc = (nutrients[chaveDe(nutrient)] ?? 0) / 100.0
        needs.set(nutrient, (needs.get(nutrient) ?? 0) - kgHa * discountConc)
      }
      applied.push({
        name, kgPerHa: kgHa, gramsPerPlant: gPlant,
        gramsPerPlantPerSplit: MICRO_TARGETS.has(target) ? null : gPlant / splits,
        mainNutrient: target,
        bagWeightKg: nutrients['bagWeightKg'] ?? 50.0,
        bagPrice: nutrients['pricePerBag'] ?? 0.0,
      })
    }
  }
  return { products: applied }
}
