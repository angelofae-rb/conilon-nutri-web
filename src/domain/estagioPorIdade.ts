/** Estágio de formação x idade da lavoura — porte de `EstagioPorIdade.kt`. */
import { type Stage, STAGES, STAGE_LABEL, isFormation } from './model'

export interface AvisoEstagio { texto: string; sugerido: Stage }

/** Meses completos entre o plantio e agora (fuso do aparelho); negativo se o plantio é no futuro. */
export function mesesDePlantio(plantioMillis: number, agoraMillis: number): number {
  const a = new Date(plantioMillis)
  const b = new Date(agoraMillis)
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) meses -= 1
  return meses
}

export function estagioPorMeses(meses: number): Stage {
  if (meses <= 0) return 'PLANTING'
  if (meses < 12) return 'FORMATION_YEAR_1'
  if (meses < 24) return 'FORMATION_YEAR_2'
  return 'PRODUCTION'
}

/** Avisa quando o estágio escolhido está antes do que a idade indica (produção adiantada é aceita). */
export function avaliarEstagio(estagio: Stage, plantioMillis: number | null, agoraMillis: number): AvisoEstagio | null {
  if (plantioMillis === null || !isFormation(estagio)) return null
  const meses = mesesDePlantio(plantioMillis, agoraMillis)
  const indicado = estagioPorMeses(meses)
  if (STAGES.indexOf(indicado) <= STAGES.indexOf(estagio)) return null
  const idade = meses === 1 ? '1 mês' : `${meses} meses`
  const label = STAGE_LABEL[indicado]
  const curto = label.includes('- ') ? label.slice(label.indexOf('- ') + 2) : label
  const texto = indicado === 'PRODUCTION'
    ? `Plantado há ${idade}: passou dos 24 meses. Pela idade, a lavoura passa para a adubação de ` +
      'produção; troque o estágio para Produção e informe a meta de sacas/ha.'
    : `Plantado há ${idade}: pela idade, o estágio é ${curto}. Troque o estágio para ajustar as doses.`
  return { texto, sugerido: indicado }
}
