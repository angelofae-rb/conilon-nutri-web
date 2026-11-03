/**
 * Números com casas fixas no padrão pt-BR, iguais ao `String.format(Locale("pt","BR"), "%.Nf")`
 * do app Android: vírgula decimal, sem separador de milhar, arredondamento "meio para cima"
 * sobre a representação decimal curta do número (o `toFixed` do JavaScript arredonda o valor
 * binário exato e daria 1,00 para 1,005 — o Android dá 1,01).
 */
export function fixed(x: number, digits: number): string {
  if (Number.isNaN(x)) return 'NaN'
  if (!Number.isFinite(x)) return x > 0 ? 'Infinity' : '-Infinity'
  const negative = x < 0 || Object.is(x, -0)
  const [mant, expPart] = Math.abs(x).toExponential().split('e')
  const exp = parseInt(expPart, 10)
  const allDigits = mant.replace('.', '')
  // valor = 0.allDigits × 10^(exp + 1)
  let intDigits: string
  let fracDigits: string
  const pointPos = exp + 1
  if (pointPos <= 0) {
    intDigits = '0'
    fracDigits = '0'.repeat(-pointPos) + allDigits
  } else if (pointPos >= allDigits.length) {
    intDigits = allDigits + '0'.repeat(pointPos - allDigits.length)
    fracDigits = ''
  } else {
    intDigits = allDigits.slice(0, pointPos)
    fracDigits = allDigits.slice(pointPos)
  }
  const keep = fracDigits.slice(0, digits).padEnd(digits, '0')
  const next = fracDigits.charCodeAt(digits) - 48 // NaN se não houver
  let number = intDigits + keep
  if (next >= 5) number = incrementDecimalString(number)
  const intLen = number.length - digits
  const intPart = number.slice(0, intLen).replace(/^0+(?=\d)/, '') || '0'
  const frac = number.slice(intLen)
  return (negative ? '-' : '') + intPart + (digits > 0 ? ',' + frac : '')
}

function incrementDecimalString(s: string): string {
  const d = s.split('')
  let i = d.length - 1
  while (i >= 0) {
    if (d[i] === '9') {
      d[i] = '0'
      i--
    } else {
      d[i] = String.fromCharCode(d[i].charCodeAt(0) + 1)
      return d.join('')
    }
  }
  return '1' + d.join('')
}

export const f0 = (v: number): string => fixed(v, 0)
export const f1 = (v: number): string => fixed(v, 1)
export const f2 = (v: number): string => fixed(v, 2)
