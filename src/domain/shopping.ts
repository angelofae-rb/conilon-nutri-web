/** Lista de compras do talhão — porte de `ShoppingListCalculator.kt`. */
import type { CommercialFertilizerResult } from './calculator'

export interface ShoppingItem {
  productName: string; target: string; totalKg: number; bagWeightKg: number
  bags: number; bagPrice: number; subtotal: number
}
export interface ShoppingList { items: ShoppingItem[]; total: number }

export function bagsFor(totalKg: number, bagWeightKg: number): number {
  if (bagWeightKg <= 0 || totalKg <= 0) return 0
  return Math.max(0, Math.ceil(totalKg / bagWeightKg - 1e-9))
}

export function buildShoppingList(
  commercial: CommercialFertilizerResult, areaHa: number, priceOverrides: Record<string, number> = {},
): ShoppingList {
  const items = commercial.products.map((p) => {
    const price = priceOverrides[p.mainNutrient] ?? p.bagPrice
    const totalKg = p.kgPerHa * areaHa
    const bags = bagsFor(totalKg, p.bagWeightKg)
    return { productName: p.name, target: p.mainNutrient, totalKg, bagWeightKg: p.bagWeightKg, bags, bagPrice: price, subtotal: bags * price }
  }).filter((i) => i.totalKg > 0)
  return { items, total: items.reduce((s, i) => s + i.subtotal, 0) }
}
