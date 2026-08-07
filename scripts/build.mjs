import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/data', { recursive: true })
await mkdir('dist/src', { recursive: true })
await cp('index.html', 'dist/index.html')
await cp('src/app.js', 'dist/src/app.js')
await cp('src/styles.css', 'dist/src/styles.css')
for (const filename of ['products.json', 'tools.json', 'quality-report.json', 'github-repositories.json', 'github-history.json']) {
  await cp(`data/${filename}`, `dist/data/${filename}`)
}
await writeFile('dist/.nojekyll', '')
const app = await readFile('dist/src/app.js', 'utf8')
for (const dataset of ['products.json', 'tools.json', 'github-repositories.json', 'github-history.json']) {
  if (!app.includes(`data/${dataset}`)) throw new Error(`app.js must reference data/${dataset}`)
}
console.log('Static site built in dist/.')
