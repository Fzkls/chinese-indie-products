import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/data', { recursive: true })
await mkdir('dist/src', { recursive: true })
await cp('index.html', 'dist/index.html')
await cp('src/app.js', 'dist/src/app.js')
await cp('src/styles.css', 'dist/src/styles.css')
await cp('data/products.json', 'dist/data/products.json')
await cp('data/quality-report.json', 'dist/data/quality-report.json')
await writeFile('dist/.nojekyll', '')
const app = await readFile('dist/src/app.js', 'utf8')
if (!app.includes("fetch('data/products.json')")) throw new Error('app.js does not reference product data')
console.log('Static site built in dist/.')
