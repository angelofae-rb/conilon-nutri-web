/**
 * O cálculo do app web tem de dar o MESMO resultado do app Android.
 *
 * `golden.json` foi gerado pelo domínio Kotlin (tools/golden/GoldenGenerator.kt) com 1.500
 * amostras variadas — estágios, metas, fronteiras de classe, camada de 20–40 cm, adubos
 * simples e formulados, desconto do que já foi aplicado. Aqui o TypeScript roda as mesmas
 * entradas e cada número e cada texto precisa bater.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { recommend } from '../recommendation'
import { buildShoppingList } from '../shopping'
import { projectYield } from '../yieldProjection'
import { avaliarEstagio, mesesDePlantio } from '../estagioPorIdade'
import type { SoilSample } from '../model'
import type { ChosenProduct, LimeApplication } from '../calculator'

interface GoldenCase {
  input: {
    sample: SoilSample; chosen: ChosenProduct[]; vDesired: number | null; prnt: number; useOm: boolean
    limeApplication: LimeApplication | null; applied: Record<string, number>; areaHa: number; prices: Record<string, number>
  }
  output: { rec: unknown; shopping: unknown; yield: unknown }
}
const golden = JSON.parse(readFileSync(fileURLToPath(new URL('./golden.json', import.meta.url)), 'utf8')) as {
  recommendation: GoldenCase[]
  estagio: { stage: string; plantio: number; agora: number; meses: number; aviso: unknown }[]
}

/** Diferenças entre o esperado (Kotlin) e o obtido (TS); números com tolerância relativa de 1e-9. */
function diff(expected: unknown, actual: unknown, path: string, out: string[]): void {
  if (out.length > 10) return
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') { out.push(`${path}: esperado ${expected}, veio ${String(actual)}`); return }
    const tol = 1e-9 * Math.max(1, Math.abs(expected))
    if (!(Math.abs(expected - actual) <= tol)) out.push(`${path}: esperado ${expected}, veio ${actual}`)
    return
  }
  if (expected === null || typeof expected !== 'object') {
    if (expected !== actual) out.push(`${path}: esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`)
    return
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      out.push(`${path}: lista com ${Array.isArray(actual) ? actual.length : 'nada'} itens, esperado ${expected.length}`)
      return
    }
    expected.forEach((e, i) => diff(e, actual[i], `${path}[${i}]`, out))
    return
  }
  if (actual === null || typeof actual !== 'object') { out.push(`${path}: esperado objeto, veio ${JSON.stringify(actual)}`); return }
  for (const [k, v] of Object.entries(expected as Record<string, unknown>)) {
    if (!(k in (actual as Record<string, unknown>))) { out.push(`${path}.${k}: ausente no TS`); continue }
    diff(v, (actual as Record<string, unknown>)[k], `${path}.${k}`, out)
  }
}

describe('cálculo igual ao do app Android (golden)', () => {
  it(`tem casos suficientes (${golden.recommendation.length})`, () => {
    expect(golden.recommendation.length).toBeGreaterThanOrEqual(1000)
  })

  it('recomendação, lista de compras e projeção batem em todos os casos', () => {
    const falhas: string[] = []
    golden.recommendation.forEach((c, i) => {
      const { input } = c
      const rec = recommend(input.sample, {
        chosenProducts: input.chosen, vDesired: input.vDesired, prnt: input.prnt,
        useOrganicMatterCredit: input.useOm, limeApplication: input.limeApplication ?? undefined,
        alreadyApplied: input.applied,
      })
      const out: string[] = []
      diff(c.output.rec, rec, `caso ${i} rec`, out)
      diff(c.output.shopping, buildShoppingList(rec.commercial, input.areaHa, input.prices), `caso ${i} compras`, out)
      diff(c.output.yield, projectYield(rec, input.applied, input.areaHa), `caso ${i} projeção`, out)
      if (out.length && falhas.length < 30) falhas.push(...out.slice(0, 3))
    })
    expect(falhas).toEqual([])
  })

  it('idade x estágio bate em todos os casos', () => {
    const falhas: string[] = []
    golden.estagio.forEach((c, i) => {
      if (mesesDePlantio(c.plantio, c.agora) !== c.meses) falhas.push(`estágio ${i}: meses`)
      const out: string[] = []
      diff(c.aviso, avaliarEstagio(c.stage as never, c.plantio, c.agora), `estágio ${i}`, out)
      falhas.push(...out)
    })
    expect(falhas).toEqual([])
  })
})
