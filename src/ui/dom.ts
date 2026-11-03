/** Utilidades de tela: escape de HTML, números em pt-BR e campos de formulário. */

export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const fmtCache = new Map<number, Intl.NumberFormat>()
/** Número para leitura: "1.234,5" (milhar com ponto, sem zeros à toa). */
export function g(x: number, decimals = 1): string {
  if (!Number.isFinite(x)) return '–'
  let f = fmtCache.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
    fmtCache.set(decimals, f)
  }
  const s = f.format(x)
  return s === '-0' ? '0' : s
}

export function money(x: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(x)
}

/** Valor do campo para edição: vazio quando 0, vírgula decimal, sem milhar. */
export function fieldValue(x: number | null | undefined): string {
  if (x === null || x === undefined || x === 0 || !Number.isFinite(x)) return ''
  return String(Math.round(x * 1e6) / 1e6).replace('.', ',')
}

/** "3,5" / "3.5" / "" -> número (vazio = 0). */
export function parseNum(s: string | null | undefined): number {
  if (!s) return 0
  const t = s.trim().replace(/\s/g, '')
  if (t === '') return 0
  // "1.234,5" -> 1234.5 ; "1234.5" -> 1234.5
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const v = Number(norm)
  return Number.isFinite(v) ? v : NaN
}

export function dateBR(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR')
}

/** "yyyy-mm-dd" (input date) <-> meia-noite local. */
export function toDateInput(ms: number | null): string {
  if (ms === null) return ''
  const d = new Date(ms)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function fromDateInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}

export interface NumFieldOpts { unit?: string; help?: string; min?: number; max?: number; required?: boolean }

export function numField(name: string, label: string, value: number, o: NumFieldOpts = {}): string {
  const id = 'f-' + name
  return `<label class="field" for="${id}">
    <span class="field-label">${esc(label)}${o.required ? ' *' : ''}</span>
    <span class="field-box"><input id="${id}" name="${esc(name)}" inputmode="decimal" autocomplete="off"
      value="${esc(fieldValue(value))}" data-min="${o.min ?? ''}" data-max="${o.max ?? ''}" ${o.required ? 'data-required="1"' : ''}>
      ${o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''}</span>
    ${o.help ? `<span class="field-help">${esc(o.help)}</span>` : ''}
    <span class="field-error" hidden></span>
  </label>`
}

export function textField(name: string, label: string, value: string, o: { help?: string; required?: boolean; placeholder?: string } = {}): string {
  const id = 'f-' + name
  return `<label class="field" for="${id}">
    <span class="field-label">${esc(label)}${o.required ? ' *' : ''}</span>
    <span class="field-box"><input id="${id}" name="${esc(name)}" value="${esc(value)}" autocomplete="off"
      ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.required ? 'data-required="1"' : ''}></span>
    ${o.help ? `<span class="field-help">${esc(o.help)}</span>` : ''}
    <span class="field-error" hidden></span>
  </label>`
}

export function segmented<T extends string | number>(name: string, label: string, options: [T, string][], value: T, help?: string): string {
  return `<fieldset class="field segmented-field">
    <legend class="field-label">${esc(label)}</legend>
    <div class="segmented" role="radiogroup">
      ${options.map(([v, l]) => `<label class="seg"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${v === value ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
    </div>
    ${help ? `<span class="field-help" data-help-for="${esc(name)}">${esc(help)}</span>` : ''}
  </fieldset>`
}

/**
 * Lê e valida os campos numéricos do formulário. Marca o erro no campo e devolve null se
 * algum valor for inválido; senão devolve nome -> número.
 */
export function readNumbers(form: HTMLFormElement): Record<string, number> | null {
  const out: Record<string, number> = {}
  let ok = true
  form.querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]').forEach((inp) => {
    const err = inp.closest('.field')?.querySelector<HTMLElement>('.field-error')
    const v = parseNum(inp.value)
    let msg = ''
    if (Number.isNaN(v)) msg = 'Número inválido'
    else if (inp.dataset.required && inp.value.trim() === '') msg = 'Obrigatório'
    else if (inp.value.trim() !== '') {
      const min = inp.dataset.min === '' ? undefined : Number(inp.dataset.min)
      const max = inp.dataset.max === '' ? undefined : Number(inp.dataset.max)
      if (min !== undefined && v < min) msg = `Mínimo ${g(min, 2)}`
      if (max !== undefined && v > max) msg = `Máximo ${g(max, 2)}`
    }
    if (err) { err.textContent = msg; err.hidden = msg === '' }
    inp.toggleAttribute('aria-invalid', msg !== '')
    if (msg) ok = false
    out[inp.name] = Number.isNaN(v) ? 0 : v
  })
  if (!ok) form.querySelector<HTMLInputElement>('[aria-invalid]')?.focus()
  return ok ? out : null
}

let toastTimer: number | undefined
export function toast(msg: string): void {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = msg
  el.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 3200)
}

export function confirmDialog(message: string, okLabel = 'Confirmar', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const d = document.createElement('dialog')
    d.className = 'dialog'
    d.innerHTML = `<p>${esc(message)}</p><div class="dialog-actions">
      <button class="btn text" value="no">Cancelar</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" value="yes">${esc(okLabel)}</button></div>`
    document.body.appendChild(d)
    d.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (b) { d.close(b.value) }
    })
    d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove() })
    d.showModal()
  })
}
