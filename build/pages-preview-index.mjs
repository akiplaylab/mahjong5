import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'

const escapedCharacters = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }
const directory = 'dist/test'
const artifactDirectory = 'preview-artifacts'
await mkdir(directory, { recursive: true })
await mkdir(artifactDirectory, { recursive: true })
const artifacts = new Set(await readdir(artifactDirectory))
const links = []
for (const { number, title, sha } of JSON.parse(process.env.PREVIEWS)) {
  const artifact = `pr-${number}-${sha}`
  if (!artifacts.has(artifact)) continue
  await cp(`${artifactDirectory}/${artifact}`, `${directory}/pr-${number}`, { recursive: true })
  const escapedTitle = title.replace(/[&<>]/g, character => escapedCharacters[character])
  links.push(`<li><a href="./pr-${number}/">PR #${number} · ${escapedTitle}</a></li>`)
}

await writeFile(`${directory}/index.html`, `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>テスト環境一覧 · Mahjong5</title>
<main>
  <h1>テスト環境一覧</h1>
  ${links.length ? `<ul>\n    ${links.join('\n    ')}\n  </ul>` : '<p>公開中のテスト環境はありません。</p>'}
  <p><a href="../">本番で遊ぶ</a></p>
</main>
</html>
`)
