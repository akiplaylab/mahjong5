import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const directory = process.argv[2]
const pr = process.env.VITE_TEST_PR
if (!/^[1-9]\d*$/.test(pr ?? '')) throw new Error('Invalid preview PR number')

const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
if (!manifest.scripts?.['build:test']) {
  const entry = join(directory, 'src/main.ts')
  const source = await readFile(entry, 'utf8')
  const storageCalls = /localStorage\.(getItem|setItem)\('mahjong5\.'/g
  if ([...source.matchAll(storageCalls)].length !== 2) {
    throw new Error('Legacy storage keys could not be isolated')
  }
  await writeFile(entry, source.replace(storageCalls, `localStorage.$1('mahjong5.test.pr-${pr}.'`))
  await copyFile(new URL('../vite.config.ts', import.meta.url), join(directory, 'vite.config.ts'))
  manifest.scripts['build:test'] = 'tsc --noEmit && vite build --mode pages-test'
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest))
}
