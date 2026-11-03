package com.ahagro.conilonnutri.golden

import com.ahagro.conilonnutri.domain.calculator.LimeApplication
import com.ahagro.conilonnutri.domain.calculator.Recommendation
import com.ahagro.conilonnutri.domain.calculator.ShoppingListCalculator
import com.ahagro.conilonnutri.domain.calculator.YieldProjector
import com.ahagro.conilonnutri.domain.model.EstagioPorIdade
import com.ahagro.conilonnutri.domain.model.SoilSample
import com.ahagro.conilonnutri.domain.model.Stage
import java.io.File
import java.util.Calendar
import java.util.TimeZone
import kotlin.random.Random

/**
 * Gera `src/domain/__tests__/golden.json`: entradas variadas e a saída do cálculo do app
 * Android (Kotlin). O teste do app web roda as mesmas entradas no TypeScript e exige o mesmo
 * resultado, número por número e texto por texto.
 *
 * Rodar (com o domínio do app Android compilado em `build/domain`):
 *   kotlinc -cp build/domain tools/golden/GoldenGenerator.kt -d build/golden
 *   kotlin -cp build/domain:build/golden com.ahagro.conilonnutri.golden.GoldenGeneratorKt src/domain/__tests__/golden.json
 * O README explica o passo a passo.
 */

// ---------- JSON mínimo (sem dependência) ----------
private fun esc(s: String) = buildString {
    append('"')
    s.forEach { c ->
        when (c) {
            '"' -> append("\\\""); '\\' -> append("\\\\"); '\n' -> append("\\n"); '\r' -> append("\\r"); '\t' -> append("\\t")
            else -> if (c < ' ') append("\\u%04x".format(c.code)) else append(c)
        }
    }
    append('"')
}

private fun json(v: Any?): String = when (v) {
    null -> "null"
    is String -> esc(v)
    is Boolean -> v.toString()
    is Int, is Long -> v.toString()
    is Double -> { require(v.isFinite()) { "número não finito" }; java.lang.Double.toString(v) }
    is Float -> json(v.toDouble())
    is Enum<*> -> esc(v.name)
    is Map<*, *> -> v.entries.joinToString(",", "{", "}") { (k, x) -> esc(k.toString()) + ":" + json(x) }
    is Iterable<*> -> v.joinToString(",", "[", "]") { json(it) }
    is Pair<*, *> -> json(listOf(v.first, v.second))
    is Triple<*, *, *> -> json(listOf(v.first, v.second, v.third))
    else -> {
        // data class: campos declarados, na ordem
        val fields = v.javaClass.declaredFields.filter { !java.lang.reflect.Modifier.isStatic(it.modifiers) }
        fields.joinToString(",", "{", "}") { f ->
            f.isAccessible = true
            esc(f.name) + ":" + json(f.get(v))
        }
    }
}

// ---------- Casos ----------
private val produtos = mapOf(
    "ureia" to mapOf("N" to 45.0, "bagWeightKg" to 50.0, "pricePerBag" to 180.0),
    "sulfAmonio" to mapOf("N" to 21.0, "S" to 24.0, "bagWeightKg" to 50.0, "pricePerBag" to 120.0),
    "ssp" to mapOf("P2O5" to 18.0, "S" to 10.0, "Ca" to 18.0, "bagWeightKg" to 50.0, "pricePerBag" to 110.0),
    "map" to mapOf("N" to 11.0, "P2O5" to 48.0, "bagWeightKg" to 50.0, "pricePerBag" to 230.0),
    "kcl" to mapOf("K2O" to 60.0, "bagWeightKg" to 50.0, "pricePerBag" to 190.0),
    "npk200020" to mapOf("N" to 20.0, "K2O" to 20.0, "bagWeightKg" to 50.0, "pricePerBag" to 150.0),
    "npk041408" to mapOf("N" to 4.0, "P2O5" to 14.0, "K2O" to 8.0, "bagWeightKg" to 50.0),
    "npk200520" to mapOf("N" to 20.0, "P2O5" to 5.0, "K2O" to 20.0, "bagWeightKg" to 50.0),
    "fte" to mapOf("S" to 3.9, "B" to 1.8, "CU" to 0.8, "MN" to 2.0, "ZN" to 9.0, "bagWeightKg" to 25.0),
    "gesso" to mapOf("Ca" to 18.0, "S" to 15.0, "bagWeightKg" to 1000.0),
    "borax" to mapOf("B" to 11.0, "bagWeightKg" to 25.0),
    "sulfZinco" to mapOf("ZN" to 20.0, "S" to 10.0, "bagWeightKg" to 25.0),
)

private val combos: List<List<Pair<String, String>>> = listOf(
    emptyList(),
    listOf("P" to "map", "K" to "kcl", "N" to "ureia"),
    listOf("P" to "ssp", "K" to "kcl", "N" to "ureia", "S" to "gesso", "B" to "fte", "ZN" to "fte"),
    listOf("P" to "ssp", "K" to "npk200020", "N" to "ureia"),
    listOf("N" to "npk200520", "P" to "ssp", "K" to "kcl"),
    listOf("K" to "npk200520", "P" to "ssp", "N" to "ureia", "B" to "borax", "ZN" to "sulfZinco"),
    listOf("N" to "npk041408", "P" to "npk041408", "K" to "npk041408"),
    listOf("S" to "sulfAmonio", "N" to "ureia", "P" to "map", "K" to "kcl", "CU" to "fte", "MN" to "fte"),
    listOf("N" to "sulfAmonio"),
)

private fun r(rnd: Random, vararg xs: Double) = xs[rnd.nextInt(xs.size)]

private fun randomSample(rnd: Random, i: Int): SoilSample {
    val stage = Stage.entries[rnd.nextInt(Stage.entries.size)]
    val sub = rnd.nextInt(4)
    return SoilSample(
        id = "s$i", stage = stage,
        rowSpacing = r(rnd, 3.0, 3.5, 2.8, 2.5, 4.0, 0.0, 3.2),
        plantSpacing = r(rnd, 1.0, 0.8, 1.2, 0.7, 1.5, 0.9),
        expectedYield = r(rnd, 0.0, 15.0, 20.0, 20.05, 25.0, 45.0, 50.0, 60.0, 61.0, 70.0, 80.0, 100.0, 120.0, 150.0, 175.0, 210.0),
        numSplits = rnd.nextInt(2, 6),
        ph = r(rnd, 0.0, 4.6, 5.0, 5.2, 5.5, 5.8, 6.2, 6.5, 6.8, 7.0, 7.3, 7.6),
        organicMatter = r(rnd, 0.0, 1.2, 2.5, 3.5, 5.0, 9.0),
        pMehlich = r(rnd, 0.0, 1.0, 2.9, 3.0, 5.0, 6.5, 7.0, 8.0, 10.0, 10.5, 12.0, 15.0, 19.9, 20.0, 21.0, 25.0, 30.0, 35.0, 50.0, 55.0, 60.0, 65.0),
        pRem = r(rnd, 0.0, 8.0, 15.0, 19.9, 20.0, 25.0, 30.0, 40.0, 40.1, 50.0),
        k = r(rnd, 0.0, 25.0, 45.0, 59.9, 59.95, 60.0, 90.0, 117.0, 120.0, 120.05, 150.0, 200.0, 200.05, 260.0),
        ca = r(rnd, 0.0, 0.3, 0.4, 0.8, 1.2, 1.5, 2.0, 2.5, 3.2, 4.0, 4.5, 6.0),
        mg = r(rnd, 0.0, 0.2, 0.4, 0.5, 0.7, 1.0, 1.2, 1.8),
        hAl = r(rnd, 0.0, 1.5, 2.5, 3.5, 4.8, 6.0, 8.5),
        al = r(rnd, 0.0, 0.1, 0.3, 0.5, 0.9, 1.4),
        sulfur = r(rnd, 0.0, 2.0, 4.9, 5.0, 8.0, 10.0, 12.0),
        clay = r(rnd, 0.0, 25.0, 45.0),
        b = r(rnd, 0.0, 0.1, 0.19, 0.2, 0.4, 0.6, 0.8),
        cu = r(rnd, 0.0, 0.3, 0.5, 1.0, 1.5, 2.0),
        fe = r(rnd, 0.0, 10.0, 20.0, 25.0, 30.0, 45.0),
        mn = r(rnd, 0.0, 3.0, 5.0, 10.0, 15.0, 20.0),
        zn = r(rnd, 0.0, 1.0, 1.99, 2.0, 4.0, 6.0, 8.0),
        subCa = if (sub == 0) 0.0 else r(rnd, 0.0, 0.2, 0.4, 0.6, 1.2),
        subMg = if (sub == 0) 0.0 else r(rnd, 0.0, 0.1, 0.3, 0.6),
        subK = if (sub == 0) 0.0 else r(rnd, 0.0, 20.0, 50.0),
        subHAl = if (sub <= 1) 0.0 else r(rnd, 0.0, 2.0, 3.5, 5.0),
        subAl = if (sub == 0) 0.0 else r(rnd, 0.0, 0.2, 0.5, 0.8, 1.2),
    )
}

private fun utcNoon(y: Int, m: Int, d: Int): Long = Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
    clear(); set(y, m - 1, d, 12, 0)
}.timeInMillis

fun main(args: Array<String>) {
    TimeZone.setDefault(TimeZone.getTimeZone("UTC"))
    val out = File(args.getOrElse(0) { "golden.json" })
    val rnd = Random(20261103)
    val cases = mutableListOf<Map<String, Any?>>()
    repeat(1500) { i ->
        val sample = randomSample(rnd, i)
        val combo = combos[rnd.nextInt(combos.size)]
        val chosen = combo.map { (alvo, p) -> Triple(p, produtos.getValue(p), alvo) }
        val vDesired: Double? = if (rnd.nextInt(5) == 0) r(rnd, 55.0, 65.0, 70.0, 80.0) else null
        val prnt = r(rnd, 80.0, 80.0, 100.0, 65.0, 0.0)
        val useOm = rnd.nextInt(3) == 0
        val lime: LimeApplication? = if (rnd.nextInt(4) == 0) LimeApplication.entries[rnd.nextInt(3)] else null
        val applied: Map<String, Double> = if (rnd.nextInt(3) == 0)
            mapOf("N" to r(rnd, 0.0, 50.0, 200.0), "P" to r(rnd, 0.0, 30.0, 120.0), "K" to r(rnd, 0.0, 60.0, 500.0), "B" to r(rnd, 0.0, 0.5), "ZN" to r(rnd, 0.0, 1.0))
        else emptyMap()
        val rec = if (lime == null) Recommendation.from(sample, chosen, vDesired, prnt, useOm, alreadyApplied = applied)
        else Recommendation.from(sample, chosen, vDesired, prnt, useOm, lime, applied)
        val area = r(rnd, 0.0, 1.0, 2.23, 5.5)
        val prices: Map<String, Double> = if (rnd.nextInt(4) == 0) mapOf("N" to 200.0, "K" to 210.0) else emptyMap()
        cases += mapOf(
            "input" to mapOf(
                "sample" to sample, "chosen" to chosen, "vDesired" to vDesired, "prnt" to prnt,
                "useOm" to useOm, "limeApplication" to lime, "applied" to applied,
                "areaHa" to area, "prices" to prices
            ),
            "output" to mapOf(
                "rec" to rec,
                "shopping" to ShoppingListCalculator.build(rec.commercial, area, prices),
                "yield" to YieldProjector.project(rec, applied, area)
            )
        )
    }

    // Idade x estágio
    val hoje = utcNoon(2026, 10, 19)
    val estagio = mutableListOf<Map<String, Any?>>()
    for (st in Stage.entries) for (y in 2023..2027) for (m in listOf(1, 3, 6, 9, 10, 11, 12)) for (d in listOf(1, 19, 20, 31)) {
        val day = minOf(d, Calendar.getInstance().apply { clear(); set(y, m - 1, 1) }.getActualMaximum(Calendar.DAY_OF_MONTH))
        val t = utcNoon(y, m, day)
        val a = EstagioPorIdade.avaliar(st, t, hoje)
        estagio += mapOf("stage" to st, "plantio" to t, "agora" to hoje,
            "meses" to EstagioPorIdade.mesesDePlantio(t, hoje), "aviso" to a)
    }

    out.writeText("{\"recommendation\":" + json(cases) + ",\"estagio\":" + json(estagio) + "}")
    println("${cases.size} casos de recomendação, ${estagio.size} de estágio -> ${out.path}")
}
