# ConilonNutri web (iPhone e navegador)

Recomendação de calagem e adubação do café conilon pelo **Incaper, Café Conilon, 3ª ed. (2019)**,
em versão web instalável (PWA). Roda no iPhone pelo Safari, no Android e no computador, funciona
**sem internet** e guarda os dados **só no aparelho**.

O cálculo é o mesmo do app Android: o teste `golden.test.ts` roda 1.500 laudos variados e exige o
mesmo número e o mesmo texto que o domínio Kotlin dá.

## O que tem nesta versão
- Talhões (área, espaçamento, estágio, meta, data de plantio com aviso de idade).
- Amostras de solo e a recomendação completa: calagem (V2 automático, PRNT, aplicação), gesso pela
  camada de 20–40 cm, N/P₂O₅/K₂O de formação e produção, enxofre, Ca/Mg, micronutrientes, diagnóstico
  de pH e projeção indicativa.
- Adubos comerciais (simples e formulados) e lista de compras em sacos e R$ para a área do talhão.
- Cálculo rápido sem salvar, cadastro de insumos, compartilhar e imprimir/PDF.
- Backup no **mesmo formato do app Android**: exporta aqui e importa lá, e vice-versa.

Ainda não tem: planejador de adubação e caderno de campo (os dados deles, vindos de um backup do
Android, são guardados e devolvidos no próximo backup).

## Publicar no GitHub Pages (uma vez)
1. Crie um repositório no GitHub (ex.: `conilon-nutri-web`) e envie estes arquivos para a branch `main`
   (pelo site: *Add file → Upload files*, arrastando o conteúdo da pasta; ou `git push`).
2. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. A aba **Actions** roda o workflow *Testar e publicar*. Em 1–2 minutos o app fica em
   `https://SEU-USUARIO.github.io/conilon-nutri-web/`.

Cada novo envio para `main` testa e republica sozinho. Se um teste do cálculo falhar, nada é publicado.

## Instalar no iPhone
1. Abra o endereço no **Safari**.
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.

Instalado assim, abre em tela cheia, funciona offline e o iOS não apaga os dados por falta de uso.
Mesmo assim, faça **backup** de vez em quando (Ajustes → Exportar backup).

## Desenvolver
```bash
npm install
npm run dev      # servidor local
npm test         # testes (inclui a conferência contra o Kotlin)
npm run build    # gera dist/
```

## Manter igual ao app Android
O cálculo está em `src/domain/` e é porte direto de `app/src/main/java/.../domain/` do Android.
Mudou uma regra no Kotlin? Mude aqui também e gere de novo o arquivo de referência:

```bash
# na pasta do projeto Android, com o kotlinc 2.x no PATH
kotlinc app/src/main/java/com/ahagro/conilonnutri/domain -d build/domain
kotlinc -cp build/domain CAMINHO/conilon-nutri-web/tools/golden/GoldenGenerator.kt -d build/golden
kotlin -cp build/domain:build/golden com.ahagro.conilonnutri.golden.GoldenGeneratorKt \
  CAMINHO/conilon-nutri-web/src/domain/__tests__/golden.json
```
Depois rode `npm test`: se o TypeScript não acompanhar a mudança, o teste mostra o caso e o campo.

## Ícones
`npm run icons` gera os PNG de `public/` (precisa de Python com Pillow).

## Fontes
Incaper, Café Conilon, 3ª ed. (2019), cap. 14; Guia de interpretação de análise de solo e foliar
(Incaper, 2013); DOC 316 (Incaper, 2025); V2 pela CTC de Paye et al. O que não é do Incaper aparece
na tela como "referência do app". A recomendação não substitui o técnico.
