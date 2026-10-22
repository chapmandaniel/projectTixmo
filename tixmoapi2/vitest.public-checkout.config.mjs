// Setup-free API DTO + browser helper contract; no DB bootstrap or dotenv.
export default {
  resolve: { alias: { '@utils': new URL('./src/utils', import.meta.url).pathname } },
  test: { environment: 'node', include: ['tests/public-checkout-contract.vitest.ts'] },
};
