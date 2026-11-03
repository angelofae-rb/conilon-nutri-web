import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import {
  type Screen, ajustesScreen, amostraFormScreen, amostraScreen, homeScreen, insumoFormScreen, insumosScreen,
  notFound, quickScreen, talhaoFormScreen, talhaoScreen,
} from './ui/screens'
import { esc, toast } from './ui/dom'

function route(hash: string): Screen {
  const p = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (p.length === 0) return homeScreen()
  switch (p[0]) {
    case 'rapido': return quickScreen()
    case 'insumos': return insumosScreen()
    case 'insumo': return insumoFormScreen(p[1] === 'novo' ? null : p[1] ?? null)
    case 'ajustes': return ajustesScreen()
    case 'talhao':
      if (p[1] === 'novo') return talhaoFormScreen(null)
      if (p[2] === 'editar') return talhaoFormScreen(p[1])
      if (p[2] === 'amostra' && p[3] === 'nova') return amostraFormScreen(p[1], null)
      return talhaoScreen(p[1])
    case 'amostra':
      if (p[2] === 'editar') return amostraFormScreen(null, p[1])
      return amostraScreen(p[1])
    default: return notFound()
  }
}

const TABS: [string, string, string][] = [
  ['home', '#/', 'Talhões'], ['rapido', '#/rapido', 'Cálculo rápido'], ['insumos', '#/insumos', 'Insumos'], ['ajustes', '#/ajustes', 'Ajustes'],
]
const ICON: Record<string, string> = {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  rapido: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  insumos: '<path d="M6 7h12l-1 13H7zM9 7V5a3 3 0 0 1 6 0v2"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
}

function render(): void {
  const screen = route(location.hash)
  const app = document.getElementById('app') as HTMLElement
  const activeTab = screen.tab ?? (location.hash.startsWith('#/insumo') ? 'insumos' : 'home')
  document.title = screen.title === 'ConilonNutri' ? 'ConilonNutri' : `${screen.title} · ConilonNutri`
  app.innerHTML = `
    <header class="topbar">
      ${screen.back ? `<a class="icon-btn" href="${esc(screen.back)}" aria-label="Voltar"><svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg></a>` : '<span class="brand-dot" aria-hidden="true"></span>'}
      <span class="topbar-title">${esc(screen.title)}</span>
    </header>
    <main class="content" id="main">${screen.html}</main>
    <nav class="tabbar" aria-label="Seções">
      ${TABS.map(([k, href, label]) => `<a href="${href}" class="${k === activeTab ? 'active' : ''}" ${k === activeTab ? 'aria-current="page"' : ''}>
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span>${label}</span></a>`).join('')}
    </nav>`
  const main = document.getElementById('main') as HTMLElement
  screen.mount?.(main)
  window.scrollTo(0, 0)
}

window.addEventListener('hashchange', render)
// Na impressão, abre os detalhes recolhidos para o papel levar tudo.
window.addEventListener('beforeprint', () => document.querySelectorAll('details').forEach((d) => { d.open = true }))
render()

registerSW({
  immediate: true,
  onOfflineReady() { toast('Pronto para usar sem internet.') },
  onNeedRefresh() { toast('Nova versão instalada: feche e abra o app para atualizar.') },
})
