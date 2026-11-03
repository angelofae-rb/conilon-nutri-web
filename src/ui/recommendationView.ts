/** Tela da recomendação: a resposta no topo, o detalhe recolhido embaixo. */
import { type ChosenProduct, LIME_APPLICATION_LABEL, type LimeApplication, limeApplicationDefaultFor, microSymbol } from '../domain/calculator'
import { defaultSelection, sortInsumos, toChosenProducts } from '../domain/insumos'
import { microInfo } from '../domain/microGuide'
import { STAGE_LABEL, STATUS_LABEL, type NutritionalStatus, type SoilSample, isFormation, isPlanting } from '../domain/model'
import { type Recommendation, recommend } from '../domain/recommendation'
import { buildShoppingList } from '../domain/shopping'
import { P_CLASS_LABEL, plantingPhosphorusClass } from '../domain/tables'
import { projectYield } from '../domain/yieldProjection'
import { type RecPrefs, data, defaultRecPrefs, prefsFor, savePrefs } from '../store'
import { dateBR, esc, fieldValue, g, money, parseNum, toast } from './dom'

const TARGET_LABEL: Record<string, string> = {
  N: 'Nitrogênio (N)', P: 'Fósforo (P₂O₅)', K: 'Potássio (K₂O)', S: 'Enxofre (S)',
  B: 'Boro (B)', ZN: 'Zinco (Zn)', CU: 'Cobre (Cu)', MN: 'Manganês (Mn)', FE: 'Ferro (Fe)',
}

let quickPrefs: RecPrefs = defaultRecPrefs()

export interface RecViewOptions {
  /** id da amostra salva (as escolhas ficam gravadas); null = cálculo rápido. */
  prefsId: string | null
  areaHa: number | null
  title?: string
}

const chip = (s: NutritionalStatus): string => `<span class="chip st-${s.toLowerCase()}">${STATUS_LABEL[s]}</span>`

function targetsNeeded(rec: Recommendation): string[] {
  const t: string[] = []
  if (rec.npk.nKgPerHa > 0) t.push('N')
  if (rec.npk.p2o5KgPerHa > 0) t.push('P')
  if (rec.npk.k2oKgPerHa > 0) t.push('K')
  if (rec.sulfur.recommendationKgPerHa > 0) t.push('S')
  rec.micronutrients.filter((m) => (m.recKgHa ?? 0) > 0).forEach((m) => t.push(microSymbol(m)))
  return t
}

export function renderRecommendation(root: HTMLElement, sample: SoilSample, o: RecViewOptions): void {
  const prefs: RecPrefs = o.prefsId ? prefsFor(o.prefsId) : quickPrefs
  const persist = (p: RecPrefs): void => {
    if (o.prefsId) savePrefs(o.prefsId, p)
    else quickPrefs = p
    renderRecommendation(root, sample, o)
  }

  const insumos = sortInsumos(data.insumos)
  const base = { vDesired: prefs.vDesired, prnt: prefs.prnt, useOrganicMatterCredit: prefs.useOm, limeApplication: prefs.limeApplication ?? undefined }
  const semAdubo = recommend(sample, base)
  // A escolha gravada vale só para os alvos que o produtor mexeu; um nutriente que passou a ser
  // necessário (laudo editado) ganha a fonte padrão em vez de ficar sem adubo. "" = nenhum, de propósito.
  const selection: Record<string, string> = { ...defaultSelection(insumos, semAdubo) }
  for (const [k, v] of Object.entries(prefs.selection ?? {})) {
    if (v === '') delete selection[k]
    else if (insumos.some((i) => i.id === v)) selection[k] = v
  }
  const chosen: ChosenProduct[] = toChosenProducts(selection, insumos)
  const rec = recommend(sample, { ...base, chosenProducts: chosen })
  const area = o.areaHa ?? 1
  const shopping = buildShoppingList(rec.commercial, area, {})
  const yp = projectYield(rec, {}, area)
  const formation = isFormation(rec.sample.stage)
  const npk = rec.npk
  const app: LimeApplication = prefs.limeApplication ?? limeApplicationDefaultFor(sample.stage)

  const limeLine = rec.liming.needed
    ? `${g(rec.liming.needLimeTonsPerHa, 1)} t/ha${rec.limeType.type ? ' · ' + (rec.limeType.type === 'DOLOMITICO' ? 'dolomítico' : 'calcítico') : ''}`
    : 'Não precisa'
  const gessoLine = rec.gypsum.indicated ? `${g(rec.gypsum.doseKgPerHa, 0)} kg/ha` : rec.gypsum.subsoilInformed ? 'Não precisa' : 'Falta 20–40 cm'

  root.innerHTML = `
  <section class="card primary">
    <div class="eyebrow">${esc(STAGE_LABEL[rec.sample.stage])} · amostra de ${esc(dateBR(sample.dateMillis))}</div>
    <h2 class="display">Resumo da dose</h2>
    <div class="dose-grid">
      ${doseTile('Calcário', limeLine)}
      ${doseTile('Gesso', gessoLine)}
      ${doseTile('N', g(npk.nKgPerHa, 0) + ' kg/ha', g(npk.nGramsPerPlant, 1) + ' g/planta')}
      ${doseTile('P₂O₅', g(npk.p2o5KgPerHa, 0) + ' kg/ha', g(npk.p2o5GramsPerPlant, 1) + ' g/planta')}
      ${doseTile('K₂O', g(npk.k2oKgPerHa, 0) + ' kg/ha', g(npk.k2oGramsPerPlant, 1) + ' g/planta')}
      ${doseTile('Plantas', g(npk.plantsPerHa, 0) + '/ha', rec.sample.numSplits + ' aplicações de N e K')}
    </div>
  </section>

  <h3 class="section-title">${formation ? 'Adubação de formação' : 'Adubação de produção'}</h3>
  <section class="card">
    <table class="table">
      <thead><tr><th></th><th>g/planta</th><th>por aplicação</th><th>kg/ha</th></tr></thead>
      <tbody>
        <tr><th>N</th><td>${g(npk.nGramsPerPlant, 1)}</td><td>${g(npk.nGramsPerPlantPerSplit, 1)}</td><td>${g(npk.nKgPerHa, 0)}</td></tr>
        <tr><th>P₂O₅</th><td>${g(npk.p2o5GramsPerPlant, 1)}</td><td>dose única</td><td>${g(npk.p2o5KgPerHa, 0)}</td></tr>
        <tr><th>K₂O</th><td>${g(npk.k2oGramsPerPlant, 1)}</td><td>${g(npk.k2oGramsPerPlantPerSplit, 1)}</td><td>${g(npk.k2oKgPerHa, 0)}</td></tr>
      </tbody>
    </table>
    <p class="muted small">Fósforo no laudo: ${esc(isPlanting(rec.sample.stage)
      ? P_CLASS_LABEL[plantingPhosphorusClass(sample.pMehlich, sample.pRem)] + ' (classes da Tabela 5, de plantio)'
      : P_CLASS_LABEL[npk.phosphorusClass])}${sample.pRem <= 0 ? ' (P-rem não informado: assumido 25 mg/L)' : ''}.
      ${formation ? 'Formação: 3 aplicações de N e K₂O no período chuvoso, uma por mês.' : 'N e K₂O parcelados de outubro a março (florada, chumbinho e granação); P₂O₅ em dose única no início das chuvas.'}</p>
    ${npk.p2o5Note ? `<p class="note warn">${esc(npk.p2o5Note)}</p>` : ''}
    ${!formation && sample.organicMatter > 0 ? `
      <label class="switch-row"><span><b>Descontar N da matéria orgânica</b><br><span class="muted small">Valor de referência do app, não do Incaper. Desligado, o N segue a tabela.</span></span>
      <input type="checkbox" data-act="om" ${prefs.useOm ? 'checked' : ''}></label>
      ${rec.organicMatterN.enabled && rec.organicMatterN.creditKgPerHa > 0 ? `<p class="small">Incaper ${g(rec.organicMatterN.baseKgPerHa, 0)} kg − ${g(rec.organicMatterN.creditKgPerHa, 0)} kg de MO = <b>${g(rec.organicMatterN.finalKgPerHa, 0)} kg N/ha</b></p>` : ''}` : ''}
  </section>

  <h3 class="section-title">Adubos e lista de compras</h3>
  <section class="card">
    ${targetsNeeded(semAdubo).length === 0 ? '<p class="muted">Nada a adubar com N, P, K, S ou micros nesta amostra.</p>' : `
    <p class="muted small">Escolha a fonte de cada nutriente. Adubo com mais de um nutriente (formulado) é descontado dos outros.</p>
    <div class="source-list">
      ${targetsNeeded(semAdubo).map((t) => sourceSelect(t, selection[t] ?? '', insumos)).join('')}
    </div>`}
    ${rec.commercial.products.length ? `
    <table class="table products">
      <thead><tr><th>Adubo</th><th>kg/ha</th><th>g/planta</th><th>por aplicação</th></tr></thead>
      <tbody>${rec.commercial.products.map((p) => `<tr><th>${esc(p.name)} <span class="muted small">${esc(p.mainNutrient === 'P' ? 'P₂O₅' : p.mainNutrient === 'K' ? 'K₂O' : p.mainNutrient)}</span></th>
        <td>${g(p.kgPerHa, 0)}</td><td>${g(p.gramsPerPlant, 1)}</td><td>${p.gramsPerPlantPerSplit !== null ? g(p.gramsPerPlantPerSplit, 1) : 'única'}</td></tr>`).join('')}</tbody>
    </table>
    <div class="shopping">
      <div class="shopping-head"><b>Para ${g(area, 2)} ha</b>${o.areaHa === null ? ' <span class="muted small">(cálculo rápido: 1 ha)</span>' : ''}</div>
      ${shopping.items.map((i) => `<div class="shop-row"><span>${esc(i.productName)}</span><span>${g(i.totalKg, 0)} kg · <b>${i.bags} ${i.bags === 1 ? 'saco' : 'sacos'}</b> de ${g(i.bagWeightKg, 0)} kg${i.subtotal > 0 ? ' · ' + money(i.subtotal) : ''}</span></div>`).join('')}
      ${shopping.total > 0 ? `<div class="shop-row total"><span>Total</span><span>${money(shopping.total)}</span></div>` : '<p class="muted small">Cadastre o preço do saco em Insumos para ver o custo.</p>'}
    </div>` : ''}
  </section>

  <h3 class="section-title">Calagem</h3>
  <section class="card">
    <div class="kv"><span>V atual</span><b>${g(rec.liming.vCurrent, 0)}%</b></div>
    <div class="kv"><span>V desejado (V2)</span><b>${g(rec.liming.vDesired, 0)}%</b></div>
    <div class="kv"><span>CTC (T)</span><b>${g(rec.liming.ctc, 1)} cmolc/dm³</b></div>
    <div class="kv big"><span>Calcário</span><b>${rec.liming.needed ? g(rec.liming.needLimeTonsPerHa, 1) + ' t/ha' : 'não precisa'}</b></div>
    ${rec.liming.needed ? `<p class="small">${esc(rec.limeType.reason)}</p>` : ''}
    <div class="inline-fields">
      <label class="field compact"><span class="field-label">PRNT do calcário</span><span class="field-box"><input inputmode="decimal" data-act="prnt" value="${esc(fieldValue(prefs.prnt))}"><span class="unit">%</span></span></label>
      <label class="field compact"><span class="field-label">V2 manual</span><span class="field-box"><input inputmode="decimal" data-act="v2" placeholder="auto" value="${esc(fieldValue(prefs.vDesired))}"><span class="unit">%</span></span></label>
    </div>
    <label class="field compact"><span class="field-label">Aplicação</span><span class="field-box"><select data-act="lime">
      ${(Object.keys(LIME_APPLICATION_LABEL) as LimeApplication[]).map((a) => `<option value="${a}" ${a === app ? 'selected' : ''}>${esc(LIME_APPLICATION_LABEL[a])}</option>`).join('')}
    </select></span></label>
    <details><summary>Por que esse V2 e avisos</summary>
      <p class="small">${esc(rec.liming.v2Reason)}</p>
      ${rec.limeType.notes.map((n) => `<p class="note">${esc(n)}</p>`).join('')}
      ${rec.liming.needed ? `<p class="small muted">${esc(rec.limeType.howToApply)}</p>` : ''}
    </details>
  </section>

  <h3 class="section-title">Gesso</h3>
  <section class="card">
    <div class="kv big"><span>Gesso agrícola</span><b>${rec.gypsum.indicated ? g(rec.gypsum.doseKgPerHa, 0) + ' kg/ha' : 'sem dose'}</b></div>
    <p class="small">${esc(rec.gypsum.reason)}</p>
    ${rec.gypsum.applicationNote ? `<p class="small muted">${esc(rec.gypsum.applicationNote)}</p>` : ''}
  </section>

  <h3 class="section-title">Enxofre, cálcio e magnésio</h3>
  <section class="card">
    <div class="kv"><span>Enxofre (S)</span>${rec.sulfur.informed ? chip(rec.sulfur.status) : '<span class="muted small">não informado</span>'}</div>
    <p class="small">${esc(rec.sulfur.note)}</p>
    <div class="kv"><span>Cálcio (Ca)</span>${chip(rec.calciumMagnesium.calciumStatus)}</div>
    <div class="kv"><span>Magnésio (Mg)</span>${chip(rec.calciumMagnesium.magnesiumStatus)}</div>
    <p class="small">${esc(rec.calciumMagnesium.note)}</p>
  </section>

  <h3 class="section-title">Micronutrientes</h3>
  <section class="card">
    ${rec.micronutrients.length === 0 ? '<p class="muted">Nenhum micronutriente informado no laudo.</p>' : rec.micronutrients.map((m) => {
      const info = microInfo(m.nutrient)
      const dose = m.recKgHa !== null && m.recKgHa > 0
        ? (isPlanting(rec.sample.stage)
          ? `<b>${g(m.recGramsPerPlant ?? 0, 1)} g por cova</b> · ${g(m.recKgHa, 1)} kg/ha no total das covas`
          : `<b>${g(m.recKgHa, 1)} kg/ha</b>${m.recGramsPerPlant !== null ? ` · ${g(m.recGramsPerPlant, 2)} g/planta` : ''}`) : ''
      return `<div class="micro">
        <div class="kv"><span>${esc(m.nutrient)} <span class="muted small">${g(m.value, 2)} mg/dm³</span></span>${chip(m.status)}</div>
        ${dose ? `<div class="small">${dose}</div>` : ''}
        <details><summary>${m.status === 'GOOD' ? 'Detalhes' : 'O que fazer'}</summary>
          <p class="small">${esc(m.recommendation)}</p>
          ${info && m.status !== 'GOOD' ? `<p class="small muted"><b>Para que serve:</b> ${esc(info.role)}<br><b>Sintomas:</b> ${esc(info.symptoms)}<br><b>Efeito:</b> ${esc(info.consequence)}<br><b>Causa comum:</b> ${esc(info.cause)}</p>` : ''}
        </details></div>`
    }).join('')}
  </section>

  ${sample.ph > 0 ? `
  <h3 class="section-title">pH</h3>
  <section class="card">
    <div class="kv"><span>pH ${g(rec.phDiagnosis.ph, 1)}</span><b>${esc(rec.phDiagnosis.bandLabel)}</b></div>
    <details><summary>O que isso muda</summary>
      <p class="small">${esc(rec.phDiagnosis.summary)}</p>
      ${rec.phDiagnosis.blocked.map((b) => `<p class="note warn"><b>${esc(b.label)}:</b> ${esc(b.action)}</p>`).join('')}
      ${rec.phDiagnosis.phosphorusFixationWarning ? `<p class="note">${esc(rec.phDiagnosis.phosphorusFixationWarning)}</p>` : ''}
      ${rec.phDiagnosis.inconsistency ? `<p class="note warn">${esc(rec.phDiagnosis.inconsistency)}</p>` : ''}
    </details>
  </section>` : ''}

  ${yp ? `
  <h3 class="section-title">Projeção de produtividade (indicativa)</h3>
  <section class="card">
    <div class="kv"><span>Meta</span><b>${g(yp.potentialScHa, 0)} sc/ha</b></div>
    <div class="kv"><span>Só com o solo, sem adubar</span><b>${g(yp.soilOnly.scHa, 0)} sc/ha</b></div>
    <p class="small muted">Faixa ${g(yp.soilOnly.pessimistic, 0)} a ${g(yp.soilOnly.optimistic, 0)} sc/ha. Estimativa do app, sem tabela publicada por trás: mostra o que mais limita, não promete sacas.</p>
    ${yp.limits.slice(0, 4).map((l) => `<div class="kv"><span>${esc(l.label)}</span><span>−${g(l.lossScHaSoil, 1)} sc/ha</span></div>`).join('')}
  </section>` : ''}

  <div class="actions-row no-print">
    <button class="btn tonal" data-act="share">Compartilhar</button>
    <button class="btn tonal" data-act="print">Imprimir / PDF</button>
  </div>
  <p class="muted small fonte">Base: Incaper, Café Conilon, 3ª ed. (2019), cap. 14; DOC 316 (2025). Valores marcados como "referência do app" não são do Incaper. Confirme com seu técnico.</p>
  `

  // ---------- Interações ----------
  root.querySelector<HTMLInputElement>('[data-act="om"]')?.addEventListener('change', (e) =>
    persist({ ...prefs, useOm: (e.target as HTMLInputElement).checked }))
  root.querySelector<HTMLInputElement>('[data-act="prnt"]')?.addEventListener('change', (e) => {
    const v = parseNum((e.target as HTMLInputElement).value)
    if (!Number.isFinite(v) || v <= 0 || v > 150) { toast('PRNT entre 1 e 150%.'); persist(prefs); return }
    persist({ ...prefs, prnt: v })
  })
  root.querySelector<HTMLInputElement>('[data-act="v2"]')?.addEventListener('change', (e) => {
    const raw = (e.target as HTMLInputElement).value.trim()
    if (raw === '') { persist({ ...prefs, vDesired: null }); return }
    const v = parseNum(raw)
    if (!Number.isFinite(v) || v < 30 || v > 90) { toast('V2 entre 30 e 90% (ou deixe vazio para automático).'); persist(prefs); return }
    persist({ ...prefs, vDesired: v })
  })
  root.querySelector<HTMLSelectElement>('[data-act="lime"]')?.addEventListener('change', (e) =>
    persist({ ...prefs, limeApplication: (e.target as HTMLSelectElement).value as LimeApplication }))
  root.querySelectorAll<HTMLSelectElement>('select[data-target]').forEach((s) =>
    s.addEventListener('change', () => {
      persist({ ...prefs, selection: { ...(prefs.selection ?? {}), [s.dataset.target as string]: s.value } })
    }))
  root.querySelector('[data-act="print"]')?.addEventListener('click', () => window.print())
  root.querySelector('[data-act="share"]')?.addEventListener('click', async () => {
    const text = shareText(rec, o.title, area)
    try {
      if (navigator.share) { await navigator.share({ title: 'Recomendação ConilonNutri', text }); return }
    } catch { return }
    try { await navigator.clipboard.writeText(text); toast('Texto copiado.') } catch { toast('Não foi possível compartilhar.') }
  })
}

function doseTile(label: string, value: string, sub = ''): string {
  return `<div class="dose-tile"><span class="dose-label">${esc(label)}</span><span class="dose-value">${esc(value)}</span>${sub ? `<span class="dose-sub">${esc(sub)}</span>` : ''}</div>`
}

function sourceSelect(target: string, selected: string, insumos: ReturnType<typeof sortInsumos>): string {
  const key = target === 'P' ? 'p2o5' : target === 'K' ? 'k2o' : target.toLowerCase()
  const options = insumos.filter((i) => ((i as unknown as Record<string, number>)[key] ?? 0) > 0)
  return `<label class="field compact"><span class="field-label">${esc(TARGET_LABEL[target] ?? target)}</span>
    <span class="field-box"><select data-target="${esc(target)}">
      <option value="">— nenhum —</option>
      ${options.map((i) => `<option value="${esc(i.id)}" ${i.id === selected ? 'selected' : ''}>${esc(i.name)} (${g((i as unknown as Record<string, number>)[key], 1)}%)</option>`).join('')}
    </select></span></label>`
}

function shareText(rec: Recommendation, title: string | undefined, area: number): string {
  const n = rec.npk
  const l: string[] = []
  l.push('Recomendação ConilonNutri' + (title ? ` — ${title}` : ''))
  l.push(`${STAGE_LABEL[rec.sample.stage]} • amostra de ${dateBR(rec.sample.dateMillis)}`)
  l.push(`${n.plantsPerHa} plantas/ha • ${rec.sample.numSplits} parcelas`)
  l.push('')
  l.push(`Calcário: ${rec.liming.needed ? g(rec.liming.needLimeTonsPerHa, 1) + ' t/ha' + (rec.limeType.type ? ' (' + (rec.limeType.type === 'DOLOMITICO' ? 'dolomítico' : 'calcítico') + ')' : '') : 'não precisa'}`)
  l.push(`Gesso: ${rec.gypsum.indicated ? g(rec.gypsum.doseKgPerHa, 0) + ' kg/ha' : 'sem dose'}`)
  l.push(`N: ${g(n.nKgPerHa, 0)} kg/ha (${g(n.nGramsPerPlant, 1)} g/planta)`)
  l.push(`P₂O₅: ${g(n.p2o5KgPerHa, 0)} kg/ha (${g(n.p2o5GramsPerPlant, 1)} g/planta)`)
  l.push(`K₂O: ${g(n.k2oKgPerHa, 0)} kg/ha (${g(n.k2oGramsPerPlant, 1)} g/planta)`)
  if (rec.sulfur.recommendationKgPerHa > 0) l.push(`S: ${g(rec.sulfur.recommendationKgPerHa, 0)} kg/ha`)
  rec.micronutrients.filter((m) => (m.recKgHa ?? 0) > 0).forEach((m) => l.push(`${m.nutrient}: ${g(m.recKgHa as number, 1)} kg/ha`))
  if (rec.commercial.products.length) {
    l.push('')
    l.push(`Adubos (${g(area, 2)} ha):`)
    rec.commercial.products.forEach((p) => l.push(`• ${p.name}: ${g(p.kgPerHa, 0)} kg/ha = ${g(p.kgPerHa * area, 0)} kg`))
  }
  l.push('')
  l.push('Base: Incaper, Café Conilon 3ª ed. (2019). Confirme com seu técnico.')
  return l.join('\n')
}
