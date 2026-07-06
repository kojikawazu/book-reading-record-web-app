// `server-only` の UT 用スタブ。vitest.config.ts の alias から解決される。
// 本番/ビルド時は本物の `server-only` がクライアント混入を検出するが、UT では no-op でよい。
export {};
