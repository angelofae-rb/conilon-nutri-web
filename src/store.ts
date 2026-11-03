/**
 * Dados do app, guardados NO APARELHO (localStorage). Nada vai para servidor.
 *
 * O backup usa o MESMO formato JSON do app Android (`formato: 1`, talhões com `stageCode`,
 * amostras e insumos com os mesmos campos): um backup feito no Android abre aqui e vice-versa.
 * O que o app web ainda não usa (safras, caderno de adubações, plano) é guardado e devolvido no
 * próximo backup, para não se perder na ida e volta.
 */
import type { LimeApplication } from './domain/calculator'
import { type Insumo, type InsumoSelection, defaultInsumos, newInsumo } from './domain/insumos'
import { type SoilSample, type Talhao, STAGE_CODE, newSample, stageFromCode, uid } from './domain/model'

export interface RecPrefs {
  prnt: number
  limeApplication: LimeApplication | null
  vDesired: number | null
  useOm: boolean
  selection: InsumoSelection | null
  priceOverrides: Record<string, number>
}
export const defaultRecPrefs = (): RecPrefs => ({
  prnt: 80, limeApplication: null, vDesired: null, useOm: false, selection: null, priceOverrides: {},
})

export interface AppData {
  talhoes: Talhao[]
  amostras: SoilSample[]
  insumos: Insumo[]
  recPrefs: Record<string, RecPrefs>
  /** Tabelas do Android que o web ainda não usa, devolvidas no backup. */
  extra: { safras: unknown[]; adubacoes: unknown[]; parcelas: unknown[] }
}

const KEY = 'conilon-nutri:dados:v1'
let memoryOnly = false

function empty(): AppData {
  return { talhoes: [], amostras: [], insumos: defaultInsumos(), recPrefs: {}, extra: { safras: [], adubacoes: [], parcelas: [] } }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const d = JSON.parse(raw) as Partial<AppData>
    return {
      talhoes: d.talhoes ?? [],
      amostras: (d.amostras ?? []).map((a) => newSample(a)),
      insumos: d.insumos ?? defaultInsumos(),
      recPrefs: d.recPrefs ?? {},
      extra: d.extra ?? { safras: [], adubacoes: [], parcelas: [] },
    }
  } catch {
    memoryOnly = true
    return empty()
  }
}

export const data: AppData = load()

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
}

/** true quando o navegador não deixou gravar (modo privado, armazenamento cheio). */
export const isMemoryOnly = (): boolean => memoryOnly

/** Pede ao navegador para não apagar os dados sozinho (Safari apaga site sem uso). */
export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist()
  } catch { /* sem suporte */ }
  return null
}

// ---------- Talhões e amostras ----------
export const talhaoById = (id: string): Talhao | undefined => data.talhoes.find((t) => t.id === id)
export const amostraById = (id: string): SoilSample | undefined => data.amostras.find((a) => a.id === id)
export const amostrasDo = (talhaoId: string): SoilSample[] =>
  data.amostras.filter((a) => a.talhaoId === talhaoId).sort((a, b) => b.dateMillis - a.dateMillis)

export function saveTalhao(t: Talhao): void {
  const i = data.talhoes.findIndex((x) => x.id === t.id)
  if (i >= 0) data.talhoes[i] = t
  else data.talhoes.unshift(t)
  // Como no Android: editar o talhão atualiza o manejo da amostra mais recente.
  const ultima = amostrasDo(t.id)[0]
  if (ultima) Object.assign(ultima, contextoDoTalhao(t))
  save()
}

export function deleteTalhao(id: string): void {
  data.talhoes = data.talhoes.filter((t) => t.id !== id)
  const ids = new Set(data.amostras.filter((a) => a.talhaoId === id).map((a) => a.id))
  data.amostras = data.amostras.filter((a) => a.talhaoId !== id)
  ids.forEach((a) => delete data.recPrefs[a])
  save()
}

export function contextoDoTalhao(t: Talhao): Pick<SoilSample, 'stage' | 'rowSpacing' | 'plantSpacing' | 'expectedYield' | 'numSplits'> {
  return { stage: t.stage, rowSpacing: t.rowSpacing, plantSpacing: t.plantSpacing, expectedYield: t.expectedYield, numSplits: Math.max(3, t.numSplits) }
}

export function saveAmostra(a: SoilSample): void {
  const i = data.amostras.findIndex((x) => x.id === a.id)
  if (i >= 0) data.amostras[i] = a
  else data.amostras.push(a)
  save()
}

export function deleteAmostra(id: string): void {
  data.amostras = data.amostras.filter((a) => a.id !== id)
  delete data.recPrefs[id]
  save()
}

export function prefsFor(sampleId: string): RecPrefs {
  return { ...defaultRecPrefs(), ...(data.recPrefs[sampleId] ?? {}) }
}
export function savePrefs(sampleId: string, p: RecPrefs): void {
  data.recPrefs[sampleId] = p
  save()
}

// ---------- Insumos ----------
export function saveInsumo(i: Insumo): void {
  const k = data.insumos.findIndex((x) => x.id === i.id)
  if (k >= 0) data.insumos[k] = i
  else data.insumos.push(i)
  save()
}
export function deleteInsumo(id: string): void {
  data.insumos = data.insumos.filter((i) => i.id !== id)
  save()
}

// ---------- Backup (formato do app Android) ----------
type Json = Record<string, unknown>
const num = (o: Json, k: string, d: number): number => (typeof o[k] === 'number' ? (o[k] as number) : d)
const str = (o: Json, k: string, d = ''): string => (typeof o[k] === 'string' ? (o[k] as string) : d)
const strOrNull = (o: Json, k: string): string | null => (typeof o[k] === 'string' && o[k] !== '' ? (o[k] as string) : null)

export function exportBackup(): string {
  const talhoes = data.talhoes.map((t) => ({
    id: t.id, name: t.name, producerName: t.producerName, stageCode: STAGE_CODE[t.stage],
    rowSpacing: t.rowSpacing, plantSpacing: t.plantSpacing, expectedYield: t.expectedYield,
    numSplits: t.numSplits, createdAtMillis: t.createdAtMillis, areaHa: t.areaHa,
    ...(t.plantingDateMillis !== null ? { plantingDateMillis: t.plantingDateMillis } : {}),
  }))
  const amostras = data.amostras.map((a) => {
    const { stage, ...rest } = a
    return { ...rest, stageCode: STAGE_CODE[stage] }
  })
  const root = {
    formato: 1,
    exportadoEmMillis: Date.now(),
    origem: 'conilon-nutri-web',
    contagens: {
      talhoes: talhoes.length, safras: data.extra.safras.length, insumos: data.insumos.length,
      amostras: amostras.length, adubacoes: data.extra.adubacoes.length, parcelas: data.extra.parcelas.length,
    },
    talhoes, safras: data.extra.safras, insumos: data.insumos, amostras,
    adubacoes: data.extra.adubacoes, parcelas: data.extra.parcelas,
    web: { recPrefs: data.recPrefs },
  }
  return JSON.stringify(root, null, 2)
}

export interface ImportResult { talhoes: number; amostras: number; insumos: number }

/** Substitui tudo pelo conteúdo do arquivo (como no Android). Lança erro com mensagem clara. */
export function importBackup(text: string): ImportResult {
  let root: Json
  try {
    root = JSON.parse(text) as Json
  } catch {
    throw new Error('O arquivo não é um backup válido (JSON ilegível).')
  }
  if (typeof root !== 'object' || root === null || !('formato' in root)) {
    throw new Error('Este arquivo não é um backup do ConilonNutri.')
  }
  const arr = (k: string): Json[] => (Array.isArray(root[k]) ? (root[k] as Json[]) : [])
  const talhoes: Talhao[] = arr('talhoes').map((o) => ({
    id: str(o, 'id') || uid(), name: str(o, 'name'), producerName: str(o, 'producerName'),
    stage: stageFromCode(num(o, 'stageCode', 0)), rowSpacing: num(o, 'rowSpacing', 3), plantSpacing: num(o, 'plantSpacing', 1),
    expectedYield: num(o, 'expectedYield', 80), numSplits: num(o, 'numSplits', 4),
    createdAtMillis: num(o, 'createdAtMillis', Date.now()), areaHa: num(o, 'areaHa', 1),
    plantingDateMillis: typeof o.plantingDateMillis === 'number' ? o.plantingDateMillis : null,
  }))
  const campos = ['rowSpacing', 'plantSpacing', 'expectedYield', 'numSplits', 'ph', 'organicMatter', 'pMehlich', 'pRem', 'k',
    'ca', 'mg', 'hAl', 'al', 'sulfur', 'clay', 'b', 'cu', 'fe', 'mn', 'zn', 'subCa', 'subMg', 'subK', 'subHAl', 'subAl'] as const
  const amostras: SoilSample[] = arr('amostras').map((o) => {
    const base = newSample({
      id: str(o, 'id') || uid(), talhaoId: strOrNull(o, 'talhaoId'), sampleNumber: str(o, 'sampleNumber'),
      dateMillis: num(o, 'dateMillis', Date.now()), stage: stageFromCode(num(o, 'stageCode', 0)), safraId: strOrNull(o, 'safraId'),
    })
    for (const c of campos) (base as unknown as Record<string, number>)[c] = num(o, c, base[c] as number)
    return base
  })
  const insumos: Insumo[] = arr('insumos').map((o) => newInsumo(str(o, 'name'), {
    id: str(o, 'id') || uid(), n: num(o, 'n', 0), p2o5: num(o, 'p2o5', 0), k2o: num(o, 'k2o', 0), ca: num(o, 'ca', 0),
    mg: num(o, 'mg', 0), s: num(o, 's', 0), b: num(o, 'b', 0), cu: num(o, 'cu', 0), fe: num(o, 'fe', 0), mn: num(o, 'mn', 0),
    zn: num(o, 'zn', 0), mo: num(o, 'mo', 0), pricePerBag: num(o, 'pricePerBag', 0), bagWeightKg: num(o, 'bagWeightKg', 50),
  }))
  const web = (root.web ?? {}) as Json
  data.talhoes = talhoes
  data.amostras = amostras
  data.insumos = insumos.length ? insumos : defaultInsumos()
  data.recPrefs = (web.recPrefs as Record<string, RecPrefs>) ?? {}
  data.extra = { safras: arr('safras'), adubacoes: arr('adubacoes'), parcelas: arr('parcelas') }
  save()
  return { talhoes: talhoes.length, amostras: amostras.length, insumos: data.insumos.length }
}
