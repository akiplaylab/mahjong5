import { defineConfig } from 'vite'

const pr = process.env.VITE_TEST_PR ?? ''
const sha = process.env.VITE_TEST_SHA ?? ''
const previewNumber = /^[1-9]\d*$/.test(pr) ? pr : 'local'
const previewRevision = previewNumber !== 'local' && /^[a-f0-9]{7,40}$/.test(sha)
  ? `PR #${previewNumber} · ${sha.slice(0, 7)}`
  : 'ローカルビルド'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages-test'
    ? `/mahjong5/test/pr-${previewNumber}/`
    : mode === 'production' ? '/mahjong5/' : '/',
  plugins: mode === 'pages-test' ? [{
    name: 'pages-preview',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'robots', content: 'noindex' }, injectTo: 'head' },
      { tag: 'style', children: 'body{grid-template-rows:auto 1fr}', injectTo: 'head' },
      {
        tag: 'aside',
        attrs: { style: 'text-align:center;font:12px/1.5 system-ui,sans-serif;margin:4px 0' },
        children: `TEST · ${previewRevision}`,
        injectTo: 'body-prepend',
      },
    ],
  }] : [],
}))
