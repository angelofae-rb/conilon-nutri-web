/** O que cada micronutriente faz e o que a falta provoca — textos de `MicronutrientGuide.kt`. */
export interface MicronutrientInfo { symbol: string; role: string; symptoms: string; consequence: string; shortRisk: string; cause: string }
const ALL: MicronutrientInfo[] = [
  {"symbol": "B", "role": "Participa da florada, do pegamento dos frutos e do crescimento de raízes e brotos.", "symptoms": "Folhas novas verde-claras e deformadas, superbrotação e morte da gema do ponteiro.", "consequence": "Menos pegamento da florada e menos chumbinho: cai a produção de grãos. É um dos micronutrientes que mais limitam o café.", "shortRisk": "Falha na florada e queda na produção.", "cause": "Solo seco e pouca matéria orgânica dificultam a absorção."},
  {"symbol": "ZN", "role": "Cresce ramos e folhas e forma os nós e entrenós onde o café produz.", "symptoms": "Folhas novas pequenas, finas e alongadas, com nervuras verdes sobre fundo amarelado, e entrenós curtos nos ramos.", "consequence": "Ramos curtos e com menos nós produtivos: menos frutos. Atenção: o sintoma lembra intoxicação por glifosato.", "shortRisk": "Ramos curtos e menos frutos.", "cause": "Calagem em excesso e pH alto reduzem a disponibilidade."},
  {"symbol": "CU", "role": "Dá resistência às paredes das células e participa das enzimas de defesa da planta.", "symptoms": "Folhas novas alongadas e deformadas, com as margens amareladas voltadas para baixo.", "consequence": "Brotações novas com crescimento comprometido. É raro no café, porque os fungicidas cúpricos já fornecem cobre.", "shortRisk": "Brotações deformadas (raro).", "cause": "Mais provável em solo orgânico ou muito arenoso."},
  {"symbol": "FE", "role": "Forma a clorofila e participa da respiração da planta.", "symptoms": "Folhas novas verde bem claro, com uma faixa verde fina ao longo das nervuras.", "consequence": "Menos fotossíntese: planta fraca e produção menor. Quase sempre vem de pH alto, calagem em excesso ou encharcamento — corrigir a causa vale mais que aplicar ferro no solo.", "shortRisk": "Folhas novas amareladas e planta fraca.", "cause": "pH alto, calagem em excesso e encharcamento."},
  {"symbol": "MN", "role": "Participa da fotossíntese e da proteção da planta contra estresse.", "symptoms": "Amarelecimento entre as nervuras das folhas novas, podendo surgir pontos secos.", "consequence": "Menos fotossíntese e crescimento mais lento.", "shortRisk": "Amarelecimento das folhas novas.", "cause": "Calagem em excesso reduz a disponibilidade."},
]
/** "B", "Zn" ou "Boro (B)". */
export function microInfo(symbol: string): MicronutrientInfo | undefined {
  const r = /\((.*?)\)/.exec(symbol)
  const code = (r ? r[1] : symbol).trim().toUpperCase()
  return ALL.find((i) => i.symbol.toUpperCase() === code)
}
