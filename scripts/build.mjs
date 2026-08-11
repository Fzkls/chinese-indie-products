import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

await rm('dist', { recursive: true, force: true })
await mkdir('dist/data', { recursive: true })
await mkdir('dist/src', { recursive: true })
await cp('index.html', 'dist/index.html')
for (const filename of ['app.js', 'styles.css', 'separated-insights.js', 'separated-insights.css', 'taxonomy-insights.js', 'taxonomy-insights.css', 'dataset-tabs.js', 'dataset-tabs.css']) {
  await cp(`src/${filename}`, `dist/src/${filename}`)
}
for (const filename of ['products.json', 'tools.json', 'quality-report.json', 'github-repositories.json', 'github-history.json', 'taxonomy.json', 'product-taxonomy.json']) {
  await cp(`data/${filename}`, `dist/data/${filename}`)
}

let index = await readFile('dist/index.html', 'utf8')
if (!index.includes('src/dataset-tabs.css')) {
  index = index.replace('</head>', '    <link rel="stylesheet" href="src/dataset-tabs.css" />\n  </head>')
}
if (!index.includes('src/taxonomy-insights.js')) {
  index = index.replace('</body>', '    <script type="module" src="src/taxonomy-insights.js"></script>\n  </body>')
}
if (!index.includes('src/dataset-tabs.js')) {
  index = index.replace('</body>', '    <script type="module" src="src/dataset-tabs.js"></script>\n  </body>')
}
await writeFile('dist/index.html', index)
await writeFile('dist/.nojekyll', '')

const app = await readFile('dist/src/app.js', 'utf8')
for (const dataset of ['products.json', 'tools.json', 'github-repositories.json', 'github-history.json']) {
  if (!app.includes(`data/${dataset}`)) throw new Error(`app.js must reference data/${dataset}`)
}
const taxonomyApp = await readFile('dist/src/taxonomy-insights.js', 'utf8')
for (const dataset of ['taxonomy.json', 'product-taxonomy.json']) {
  if (!taxonomyApp.includes(`data/${dataset}`)) throw new Error(`taxonomy-insights.js must reference data/${dataset}`)
}
const datasetTabs = await readFile('dist/src/dataset-tabs.js', 'utf8')
for (const dataset of ['products.json', 'tools.json', 'taxonomy.json', 'product-taxonomy.json']) {
  if (!datasetTabs.includes(`data/${dataset}`)) throw new Error(`dataset-tabs.js must reference data/${dataset}`)
}
if (!index.includes('src/taxonomy-insights.js')) throw new Error('dist/index.html must load taxonomy-insights.js')
if (!index.includes('src/dataset-tabs.js') || !index.includes('src/dataset-tabs.css')) throw new Error('dist/index.html must load dataset tab assets')
if (index.includes('dataset-tabs-refine')) throw new Error('legacy refinement assets must not be loaded')
console.log('Static site built in dist/.')
