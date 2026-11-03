import { defineConfig } from 'vitest/config'

// Datas de referência do golden são meio-dia UTC; o fuso do teste não muda o dia.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
