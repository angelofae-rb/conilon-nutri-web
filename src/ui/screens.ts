/** Telas do app. Cada uma devolve o HTML e liga os eventos no container. */
import { avaliarEstagio } from '../domain/estagioPorIdade'
import { type Insumo, newInsumo, sortInsumos } from '../domain/insumos'
import {
  type SoilSample, type Stage, type Talhao, STAGES, STAGE_LABEL, newSample, plantsPerHaOf, stageShort, uid,
} from '../domain/model'
import {
  amostraById, amostrasDo, contextoDoTalhao, data, deleteAmostra, deleteInsumo, deleteTalhao,
  exportBackup, importBackup, isMemoryOnly, requestPersistence, saveAmostra, saveInsumo, saveTalhao, talhaoById,
} from '../store'
import {
  confirmDialog, dateBR, esc, fromDateInput, g, money, numField, readNumbers, segmented, textField, toDateInput, toast,
} from './dom'
import { renderRecommendation } from './recommendationView'

export interface Screen { title: string; back?: string; html: string; mount?: (root: HTMLElement) => void; tab?: string }

const STAGE_HELP: Record<Stage, string> = {
  PLANTING: 'Antes de plantar ou no dia do plantio: P₂O₅ e micros na cova, calcário incorporado, e já programa o N e o K₂O do 1º ano.',
  FORMATION_YEAR_1: 'Lavoura já plantada: só N e K₂O em cobertura. Se ela começar a produzir antes dos 2 anos, escolha Produção (Incaper 2019).',
  FORMATION_YEAR_2: 'Lavoura já plantada: só N e K₂O em cobertura. Se ela começar a produzir antes dos 2 anos, escolha Produção (Incaper 2019).',
  PRODUCTION: 'Dose pela meta de sacas/ha.',
}

const stageOptions = (): [Stage, string][] => STAGES.map((s) => [s, stageShort(s)])

/** Mostra/esconde meta e parcelamento conforme o estágio e atualiza a legenda. */
function wireStage(root: HTMLElement): void {
  const update = (): void => {
    const st = (root.querySelector<HTMLInputElement>('input[name="stage"]:checked')?.value ?? 'PRODUCTION') as Stage
    root.querySelectorAll<HTMLElement>('[data-only-production]').forEach((el) => { el.hidden = st !== 'PRODUCTION' })
    root.querySelectorAll<HTMLElement>('[data-only-formation]').forEach((el) => { el.hidden = st === 'PRODUCTION' })
    const help = root.querySelector<HTMLElement>('[data-help-for="stage"]')
    if (help) help.textContent = STAGE_HELP[st]
  }
  root.querySelectorAll('input[name="stage"]').forEach((i) => i.addEventListener('change', update))
  update()
}

function manejoFields(v: { stage: Stage; rowSpacing: number; plantSpacing: number; expectedYield: number; numSplits: number }): string {
  return `
    ${segmented('stage', 'Estágio', stageOptions(), v.stage, STAGE_HELP[v.stage])}
    <div class="row2">
      ${numField('rowSpacing', 'Entre linhas', v.rowSpacing, { unit: 'm', min: 0.5, max: 10, required: true })}
      ${numField('plantSpacing', 'Entre plantas', v.plantSpacing, { unit: 'm', min: 0.2, max: 5, required: true })}
    </div>
    <div data-only-production>
      ${numField('expectedYield', 'Produtividade esperada', v.expectedYield, { unit: 'sc/ha', min: 1, max: 400, help: 'Define a dose de N e K₂O (80 sc/ha = 440 kg N/ha). Use a meta realista do talhão.' })}
      ${segmented('numSplits', 'Parcelamento de N e K₂O', [[3, '3'], [4, '4'], [5, '5']], Math.min(5, Math.max(3, v.numSplits)), 'Incaper: no mínimo 3, no período chuvoso (floração, chumbinho e granação).')}
    </div>
    <p class="field-help" data-only-formation>Formação: 3 aplicações de N e K₂O no período chuvoso, uma por mês (Incaper 2019, Tabela 6).</p>`
}

function readManejo(form: HTMLFormElement, nums: Record<string, number>): { stage: Stage; rowSpacing: number; plantSpacing: number; expectedYield: number; numSplits: number } | null {
  const fd = new FormData(form)
  const stage = (fd.get('stage') as Stage) ?? 'PRODUCTION'
  if (stage === 'PRODUCTION' && !(nums.expectedYield > 0)) {
    const inp = form.querySelector<HTMLInputElement>('input[name="expectedYield"]')
    const err = inp?.closest('.field')?.querySelector<HTMLElement>('.field-error')
    if (err) { err.textContent = 'Informe a meta de sacas/ha: ela define a dose de N e K₂O.'; err.hidden = false }
    inp?.focus()
    return null
  }
  return {
    stage, rowSpacing: nums.rowSpacing, plantSpacing: nums.plantSpacing,
    expectedYield: stage === 'PRODUCTION' ? nums.expectedYield : 0,
    numSplits: Number(fd.get('numSplits') ?? 4),
  }
}

function laudoFields(s: SoilSample): string {
  return `
    <h3 class="section-title">Laudo (0 a 20 cm)</h3>
    <div class="card form-card">
      <div class="row2">${numField('ph', 'pH (água)', s.ph, { min: 2, max: 10 })}${numField('organicMatter', 'Matéria orgânica', s.organicMatter, { unit: 'dag/kg', min: 0, max: 30 })}</div>
      <div class="row2">${numField('pMehlich', 'P (Mehlich-1)', s.pMehlich, { unit: 'mg/dm³', min: 0, max: 500 })}${numField('pRem', 'P-rem', s.pRem, { unit: 'mg/L', min: 0, max: 60, help: 'Sem P-rem o app assume 25.' })}</div>
      <div class="row2">${numField('k', 'K', s.k, { unit: 'mg/dm³', min: 0, max: 1500, help: 'Em cmolc? multiplique por 391.' })}${numField('sulfur', 'S-SO₄', s.sulfur, { unit: 'mg/dm³', min: 0, max: 300 })}</div>
      <div class="row2">${numField('ca', 'Ca', s.ca, { unit: 'cmolc/dm³', min: 0, max: 30 })}${numField('mg', 'Mg', s.mg, { unit: 'cmolc/dm³', min: 0, max: 15 })}</div>
      <div class="row2">${numField('hAl', 'H+Al', s.hAl, { unit: 'cmolc/dm³', min: 0, max: 30 })}${numField('al', 'Al', s.al, { unit: 'cmolc/dm³', min: 0, max: 10 })}</div>
    </div>
    <details class="card form-card" ${s.b || s.zn || s.cu || s.fe || s.mn ? 'open' : ''}><summary><b>Micronutrientes</b></summary>
      <div class="row2">${numField('b', 'B', s.b, { unit: 'mg/dm³', min: 0, max: 20 })}${numField('zn', 'Zn', s.zn, { unit: 'mg/dm³', min: 0, max: 200 })}</div>
      <div class="row2">${numField('cu', 'Cu', s.cu, { unit: 'mg/dm³', min: 0, max: 100 })}${numField('mn', 'Mn', s.mn, { unit: 'mg/dm³', min: 0, max: 500 })}</div>
      <div class="row2">${numField('fe', 'Fe', s.fe, { unit: 'mg/dm³', min: 0, max: 1000 })}${numField('clay', 'Argila (opcional)', s.clay, { unit: '%', min: 0, max: 100 })}</div>
    </details>
    <details class="card form-card" ${s.subHAl || s.subCa || s.subAl ? 'open' : ''}><summary><b>Camada de 20 a 40 cm (gesso)</b></summary>
      <p class="field-help">O Incaper decide o gesso nesta camada. Precisa de H+Al e de Ca ou Mg.</p>
      <div class="row2">${numField('subCa', 'Ca', s.subCa, { unit: 'cmolc/dm³', min: 0, max: 30 })}${numField('subMg', 'Mg', s.subMg, { unit: 'cmolc/dm³', min: 0, max: 15 })}</div>
      <div class="row2">${numField('subK', 'K', s.subK, { unit: 'mg/dm³', min: 0, max: 1500 })}${numField('subHAl', 'H+Al', s.subHAl, { unit: 'cmolc/dm³', min: 0, max: 30 })}</div>
      <div class="row2">${numField('subAl', 'Al', s.subAl, { unit: 'cmolc/dm³', min: 0, max: 10 })}<span></span></div>
    </details>`
}

const LAUDO_KEYS = ['ph', 'organicMatter', 'pMehlich', 'pRem', 'k', 'sulfur', 'ca', 'mg', 'hAl', 'al', 'b', 'zn', 'cu', 'mn', 'fe', 'clay', 'subCa', 'subMg', 'subK', 'subHAl', 'subAl'] as const
function applyLaudo(s: SoilSample, nums: Record<string, number>): SoilSample {
  const out = { ...s }
  for (const k of LAUDO_KEYS) (out as unknown as Record<string, number>)[k] = nums[k] ?? 0
  return out
}

function laudoVazio(s: SoilSample): boolean {
  return s.ca + s.mg + s.hAl + s.k + s.pMehlich === 0
}

// ---------------- Início ----------------
export function homeScreen(): Screen {
  const talhoes = [...data.talhoes].sort((a, b) => b.createdAtMillis - a.createdAtMillis)
  const card = (t: Talhao): string => {
    const amostras = amostrasDo(t.id)
    const ultima = amostras[0]
    const aviso = avaliarEstagio(t.stage, t.plantingDateMillis, Date.now())
    const velha = ultima && Date.now() - ultima.dateMillis > 365 * 86400000
    return `<a class="card talhao-card" href="#/talhao/${esc(t.id)}">
      <div class="talhao-head"><b class="talhao-name">${esc(t.name)}</b><span class="chip">${esc(stageShort(t.stage))}</span></div>
      <div class="muted small">${t.producerName ? esc(t.producerName) + ' · ' : ''}${g(t.areaHa, 2)} ha · ${g(t.rowSpacing, 1)} × ${g(t.plantSpacing, 1)} m</div>
      <div class="small ${!ultima || velha ? 'warn-text' : ''}">${ultima ? `Última amostra: ${esc(dateBR(ultima.dateMillis))}${velha ? ' · mais de 1 ano' : ''}` : 'Sem amostra de solo'}</div>
      ${aviso ? `<div class="small warn-text">${esc(aviso.texto)}</div>` : ''}
    </a>`
  }
  return {
    title: 'ConilonNutri', tab: 'home',
    html: `
      ${isMemoryOnly() ? '<p class="note warn">O navegador não deixou gravar os dados (modo privado?). O que você fizer agora some ao fechar.</p>' : ''}
      <div class="hero">
        <h1 class="display">Seus talhões</h1>
        <p class="muted">Recomendação de calagem e adubação do conilon pelo Incaper 2019. Os dados ficam só neste aparelho.</p>
      </div>
      <div class="actions-row">
        <a class="btn primary" href="#/talhao/novo">+ Novo talhão</a>
        <a class="btn tonal" href="#/rapido">Cálculo rápido</a>
      </div>
      ${talhoes.length ? `<div class="list">${talhoes.map(card).join('')}</div>` :
        `<div class="card empty"><p><b>Nenhum talhão ainda.</b></p><p class="muted small">Cadastre o talhão (área, espaçamento, estágio) e depois a amostra de solo. Para uma conta avulsa, use o Cálculo rápido.</p></div>`}`,
  }
}

// ---------------- Talhão: formulário ----------------
export function talhaoFormScreen(id: string | null): Screen {
  const t: Talhao = (id && talhaoById(id)) || {
    id: uid(), name: '', producerName: '', stage: 'PRODUCTION', rowSpacing: 3, plantSpacing: 1,
    expectedYield: 0, numSplits: 4, createdAtMillis: Date.now(), areaHa: 1, plantingDateMillis: null,
  }
  return {
    title: id ? 'Editar talhão' : 'Novo talhão', back: id ? `#/talhao/${id}` : '#/',
    html: `<form class="stack" novalidate>
      <div class="card form-card">
        ${textField('name', 'Nome do talhão', t.name, { required: true })}
        ${textField('producerName', 'Produtor (opcional)', t.producerName)}
        ${numField('areaHa', 'Área do talhão', t.areaHa, { unit: 'ha', min: 0.01, max: 10000, required: true, help: 'Base dos totais em kg, sacos e R$.' })}
        <label class="field"><span class="field-label">Data de plantio (opcional)</span>
          <span class="field-box"><input type="date" name="plantingDate" value="${esc(toDateInput(t.plantingDateMillis))}"></span>
          <span class="field-help">Com ela o app avisa quando o estágio ficou para trás da idade da lavoura.</span></label>
        <p class="note warn" data-aviso-idade hidden></p>
      </div>
      <div class="card form-card">${manejoFields(t)}</div>
      <div class="actions-row"><button class="btn primary" type="submit">Salvar</button></div>
    </form>`,
    mount(root) {
      const form = root.querySelector('form') as HTMLFormElement
      wireStage(root)
      const aviso = root.querySelector<HTMLElement>('[data-aviso-idade]') as HTMLElement
      const updateAviso = (): void => {
        const st = (new FormData(form).get('stage') as Stage) ?? 'PRODUCTION'
        const plantio = fromDateInput((form.elements.namedItem('plantingDate') as HTMLInputElement).value)
        const a = avaliarEstagio(st, plantio, Date.now())
        aviso.hidden = !a
        aviso.textContent = a?.texto ?? ''
      }
      form.addEventListener('change', updateAviso)
      updateAviso()
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const nums = readNumbers(form)
        const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
        const nameErr = form.querySelector<HTMLElement>('#f-name')?.closest('.field')?.querySelector<HTMLElement>('.field-error')
        if (nameErr) { nameErr.textContent = name ? '' : 'Dê um nome ao talhão'; nameErr.hidden = !!name }
        if (!nums || !name) return
        const m = readManejo(form, nums)
        if (!m) return
        const novo: Talhao = {
          ...t, name, producerName: (form.elements.namedItem('producerName') as HTMLInputElement).value.trim(),
          areaHa: Math.max(0.01, nums.areaHa || 1),
          plantingDateMillis: fromDateInput((form.elements.namedItem('plantingDate') as HTMLInputElement).value),
          ...m, expectedYield: m.stage === 'PRODUCTION' ? m.expectedYield : t.expectedYield,
        }
        saveTalhao(novo)
        toast('Talhão salvo.')
        location.hash = `#/talhao/${novo.id}`
      })
    },
  }
}

// ---------------- Talhão: detalhe ----------------
export function talhaoScreen(id: string): Screen {
  const t = talhaoById(id)
  if (!t) return notFound()
  const amostras = amostrasDo(id)
  const aviso = avaliarEstagio(t.stage, t.plantingDateMillis, Date.now())
  return {
    title: t.name, back: '#/',
    html: `
      <section class="card primary">
        <div class="eyebrow">${esc(STAGE_LABEL[t.stage])}</div>
        <h2 class="display">${esc(t.name)}</h2>
        <div class="small">${g(t.rowSpacing, 1)} × ${g(t.plantSpacing, 1)} m · ${g(plantsPerHaOf(t), 0)} plantas/ha · ${g(t.areaHa, 2)} ha${t.stage === 'PRODUCTION' ? ` · meta ${g(t.expectedYield, 0)} sc/ha` : ''}</div>
        ${t.plantingDateMillis ? `<div class="small">Plantio: ${esc(dateBR(t.plantingDateMillis))}</div>` : ''}
        ${aviso ? `<p class="note warn">${esc(aviso.texto)}</p>` : ''}
      </section>
      <div class="actions-row">
        <a class="btn primary" href="#/talhao/${esc(id)}/amostra/nova">+ Nova amostra</a>
        <a class="btn tonal" href="#/talhao/${esc(id)}/editar">Editar talhão</a>
      </div>
      <h3 class="section-title">Amostras de solo</h3>
      ${amostras.length ? `<div class="list">${amostras.map((a, i) => `<a class="card row-card" href="#/amostra/${esc(a.id)}">
        <span><b>${esc(dateBR(a.dateMillis))}</b>${a.sampleNumber ? ` · nº ${esc(a.sampleNumber)}` : ''}${i === 0 ? ' <span class="chip">mais recente</span>' : ''}<br>
        <span class="muted small">pH ${g(a.ph, 1)} · P ${g(a.pMehlich, 1)} · K ${g(a.k, 0)} · ${esc(stageShort(a.stage))}</span></span><span class="chev">›</span></a>`).join('')}</div>`
        : '<div class="card empty"><p class="muted">Cadastre a análise de solo para ver a recomendação.</p></div>'}
      <div class="actions-row danger-zone"><button class="btn text danger" data-act="del">Excluir talhão</button></div>`,
    mount(root) {
      root.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
        if (await confirmDialog(`Excluir "${t.name}" e as ${amostras.length} amostras dele? Não dá para desfazer.`, 'Excluir', true)) {
          deleteTalhao(id)
          toast('Talhão excluído.')
          location.hash = '#/'
        }
      })
    },
  }
}

// ---------------- Amostra: formulário ----------------
export function amostraFormScreen(talhaoId: string | null, amostraId: string | null): Screen {
  const existente = amostraId ? amostraById(amostraId) : undefined
  const tId = existente?.talhaoId ?? talhaoId
  const t = tId ? talhaoById(tId) : undefined
  if (!t) return notFound()
  const s = existente ?? newSample({ talhaoId: t.id, ...contextoDoTalhao(t) })
  return {
    title: existente ? 'Editar amostra' : 'Nova amostra', back: existente ? `#/amostra/${existente.id}` : `#/talhao/${t.id}`,
    html: `<form class="stack" novalidate>
      <div class="card form-card">
        <div class="eyebrow">${esc(t.name)} · ${esc(STAGE_LABEL[t.stage])}</div>
        <div class="row2">
          <label class="field"><span class="field-label">Data da coleta</span><span class="field-box"><input type="date" name="date" value="${esc(toDateInput(s.dateMillis))}" required></span></label>
          ${textField('sampleNumber', 'Nº do laudo (opcional)', s.sampleNumber)}
        </div>
        <p class="field-help">Estágio, espaçamento e meta vêm do talhão. Para mudar, edite o talhão.</p>
      </div>
      ${laudoFields(s)}
      <div class="actions-row">
        <button class="btn primary" type="submit">Salvar e ver recomendação</button>
        ${existente ? '<button class="btn text danger" type="button" data-act="del">Excluir amostra</button>' : ''}
      </div>
    </form>`,
    mount(root) {
      const form = root.querySelector('form') as HTMLFormElement
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const nums = readNumbers(form)
        if (!nums) return
        const date = fromDateInput((form.elements.namedItem('date') as HTMLInputElement).value) ?? Date.now()
        const nova = applyLaudo({ ...s, dateMillis: date, sampleNumber: (form.elements.namedItem('sampleNumber') as HTMLInputElement).value.trim() }, nums)
        if (laudoVazio(nova)) { toast('Preencha pelo menos Ca, Mg, K, P ou H+Al do laudo.'); return }
        saveAmostra(nova)
        toast('Amostra salva.')
        location.hash = `#/amostra/${nova.id}`
      })
      root.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
        if (existente && await confirmDialog('Excluir esta amostra?', 'Excluir', true)) {
          deleteAmostra(existente.id)
          location.hash = `#/talhao/${t.id}`
        }
      })
    },
  }
}

// ---------------- Recomendação de amostra salva ----------------
export function amostraScreen(id: string): Screen {
  const a = amostraById(id)
  if (!a) return notFound()
  const t = a.talhaoId ? talhaoById(a.talhaoId) : undefined
  return {
    title: 'Recomendação', back: t ? `#/talhao/${t.id}` : '#/',
    html: `<div class="actions-row"><a class="btn text" href="#/amostra/${esc(id)}/editar">Editar laudo</a></div><div data-rec></div>`,
    mount(root) {
      renderRecommendation(root.querySelector('[data-rec]') as HTMLElement, a, { prefsId: a.id, areaHa: t?.areaHa ?? null, title: t?.name })
    },
  }
}

// ---------------- Cálculo rápido ----------------
let quickSample: SoilSample = newSample({ expectedYield: 0 })
export function quickScreen(): Screen {
  const s = quickSample
  return {
    title: 'Cálculo rápido', tab: 'rapido',
    html: `<p class="muted">Preencha o laudo e veja a dose na hora. Nada é salvo.</p>
      <form class="stack" novalidate>
        <div class="card form-card">${manejoFields(s)}</div>
        ${laudoFields(s)}
        <div class="actions-row"><button class="btn primary" type="submit">Calcular</button></div>
      </form>
      <div data-rec class="stack"></div>`,
    mount(root) {
      const form = root.querySelector('form') as HTMLFormElement
      wireStage(root)
      const out = root.querySelector('[data-rec]') as HTMLElement
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const nums = readNumbers(form)
        if (!nums) return
        const m = readManejo(form, nums)
        if (!m) return
        quickSample = applyLaudo({ ...quickSample, ...m, dateMillis: Date.now() }, nums)
        if (laudoVazio(quickSample)) { toast('Preencha pelo menos Ca, Mg, K, P ou H+Al do laudo.'); return }
        renderRecommendation(out, quickSample, { prefsId: null, areaHa: null })
        out.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
  }
}

// ---------------- Insumos ----------------
export function insumosScreen(): Screen {
  const list = sortInsumos(data.insumos)
  const gar = (i: Insumo): string => {
    const parts: string[] = []
    const add = (l: string, v: number): void => { if (v > 0) parts.push(`${l} ${g(v, 1)}%`) }
    add('N', i.n); add('P₂O₅', i.p2o5); add('K₂O', i.k2o); add('Ca', i.ca); add('Mg', i.mg); add('S', i.s)
    add('B', i.b); add('Zn', i.zn); add('Cu', i.cu); add('Mn', i.mn); add('Fe', i.fe)
    return parts.join(' · ') || 'sem garantias'
  }
  return {
    title: 'Insumos', tab: 'insumos',
    html: `<p class="muted">Adubos disponíveis para a recomendação. Informe o preço do saco para ver o custo na lista de compras.</p>
      <div class="actions-row"><a class="btn primary" href="#/insumo/novo">+ Novo insumo</a></div>
      <div class="list">${list.map((i) => `<a class="card row-card" href="#/insumo/${esc(i.id)}"><span><b>${esc(i.name)}</b><br>
        <span class="muted small">${esc(gar(i))}</span><br><span class="small">Saco de ${g(i.bagWeightKg, 0)} kg${i.pricePerBag > 0 ? ' · ' + money(i.pricePerBag) : ''}</span></span><span class="chev">›</span></a>`).join('')}</div>`,
  }
}

export function insumoFormScreen(id: string | null): Screen {
  const i = (id && data.insumos.find((x) => x.id === id)) || newInsumo('')
  return {
    title: id ? 'Editar insumo' : 'Novo insumo', back: '#/insumos',
    html: `<form class="stack" novalidate>
      <div class="card form-card">
        ${textField('name', 'Nome', i.name, { required: true, placeholder: 'Ex.: 20-05-20' })}
        <div class="row2">${numField('bagWeightKg', 'Peso do saco', i.bagWeightKg, { unit: 'kg', min: 1, max: 2000, required: true })}${numField('pricePerBag', 'Preço do saco', i.pricePerBag, { unit: 'R$', min: 0, max: 100000 })}</div>
      </div>
      <h3 class="section-title">Garantias (% no rótulo)</h3>
      <div class="card form-card">
        <div class="row3">${numField('n', 'N', i.n, { unit: '%', min: 0, max: 100 })}${numField('p2o5', 'P₂O₅', i.p2o5, { unit: '%', min: 0, max: 100 })}${numField('k2o', 'K₂O', i.k2o, { unit: '%', min: 0, max: 100 })}</div>
        <div class="row3">${numField('ca', 'Ca', i.ca, { unit: '%', min: 0, max: 100 })}${numField('mg', 'Mg', i.mg, { unit: '%', min: 0, max: 100 })}${numField('s', 'S', i.s, { unit: '%', min: 0, max: 100 })}</div>
        <div class="row3">${numField('b', 'B', i.b, { unit: '%', min: 0, max: 100 })}${numField('zn', 'Zn', i.zn, { unit: '%', min: 0, max: 100 })}${numField('cu', 'Cu', i.cu, { unit: '%', min: 0, max: 100 })}</div>
        <div class="row3">${numField('mn', 'Mn', i.mn, { unit: '%', min: 0, max: 100 })}${numField('fe', 'Fe', i.fe, { unit: '%', min: 0, max: 100 })}${numField('mo', 'MO', i.mo, { unit: '%', min: 0, max: 100 })}</div>
      </div>
      <div class="actions-row"><button class="btn primary" type="submit">Salvar</button>
        ${id ? '<button class="btn text danger" type="button" data-act="del">Excluir</button>' : ''}</div>
    </form>`,
    mount(root) {
      const form = root.querySelector('form') as HTMLFormElement
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const nums = readNumbers(form)
        const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim()
        if (!nums) return
        if (!name) { toast('Dê um nome ao insumo.'); return }
        saveInsumo({ ...i, name, ...nums, bagWeightKg: nums.bagWeightKg || 50 } as Insumo)
        toast('Insumo salvo.')
        location.hash = '#/insumos'
      })
      root.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
        if (await confirmDialog(`Excluir "${i.name}"?`, 'Excluir', true)) { deleteInsumo(i.id); location.hash = '#/insumos' }
      })
    },
  }
}

// ---------------- Ajustes e backup ----------------
export function ajustesScreen(): Screen {
  return {
    title: 'Ajustes', tab: 'ajustes',
    html: `
      <h3 class="section-title">Backup</h3>
      <section class="card">
        <p class="small">Os dados ficam só neste aparelho. Faça backup de vez em quando e guarde o arquivo (Arquivos, iCloud, WhatsApp).
          O arquivo é o mesmo do app Android: dá para levar a fazenda de um para o outro.</p>
        <div class="actions-row">
          <button class="btn primary" data-act="export">Exportar backup</button>
          <label class="btn tonal">Importar backup<input type="file" accept="application/json,.json" data-act="import" hidden></label>
        </div>
        <p class="muted small">${data.talhoes.length} talhões · ${data.amostras.length} amostras · ${data.insumos.length} insumos</p>
      </section>
      <h3 class="section-title">Instalar no iPhone</h3>
      <section class="card">
        <ol class="small steps">
          <li>Abra este endereço no <b>Safari</b>.</li>
          <li>Toque em <b>Compartilhar</b> (quadrado com seta).</li>
          <li>Escolha <b>Adicionar à Tela de Início</b>.</li>
        </ol>
        <p class="muted small">Instalado assim, o app abre em tela cheia, funciona sem internet e o iPhone não apaga os dados por falta de uso.</p>
        <p class="small" data-persist></p>
      </section>
      <h3 class="section-title">Sobre</h3>
      <section class="card">
        <p class="small"><b>ConilonNutri web</b> · versão ${esc(__APP_VERSION__)}</p>
        <p class="small muted">Cálculo: Incaper, Café Conilon, 3ª ed. (2019), cap. 14; Guia de interpretação (Incaper, 2013); DOC 316 (2025); V2 pela CTC de Paye et al. O que não é do Incaper aparece como "referência do app". A recomendação não substitui o técnico.</p>
        <p class="small muted">Mesmo cálculo do app Android, conferido em 1.500 casos de teste.</p>
      </section>`,
    mount(root) {
      root.querySelector('[data-act="export"]')?.addEventListener('click', () => {
        const blob = new Blob([exportBackup()], { type: 'application/json' })
        const a = document.createElement('a')
        const d = new Date()
        a.href = URL.createObjectURL(blob)
        a.download = `conilon-nutri-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
        document.body.appendChild(a)
        a.click()
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
      })
      root.querySelector<HTMLInputElement>('[data-act="import"]')?.addEventListener('change', async (e) => {
        const input = e.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        if (!(await confirmDialog('Importar substitui TODOS os dados deste aparelho pelos do arquivo. Continuar?', 'Importar', true))) return
        try {
          const r = importBackup(await file.text())
          toast(`Backup restaurado: ${r.talhoes} talhões, ${r.amostras} amostras.`)
          location.hash = '#/'
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Falha ao importar.')
        }
      })
      const p = root.querySelector<HTMLElement>('[data-persist]')
      requestPersistence().then((ok) => {
        if (p && ok !== null) p.textContent = ok ? 'Armazenamento protegido neste aparelho.' : 'O navegador ainda pode apagar os dados se o app ficar sem uso: instale na tela de início e faça backup.'
      })
    },
  }
}

export function notFound(): Screen {
  return { title: 'Não encontrado', back: '#/', html: '<div class="card empty"><p>Este item não existe mais neste aparelho.</p><a class="btn tonal" href="#/">Voltar ao início</a></div>' }
}
