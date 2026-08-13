import { readFileSync, writeFileSync } from 'node:fs'

import Bun from 'bun'

const build = await Bun.build({
  entrypoints: ['./src/bot.ts'],
  target: 'browser',
})
for (const log of build.logs) console.log(log)
let content = await build.outputs[0].text()
const buildWorker = await Bun.build({
  entrypoints: ['./src/worker.ts'],
  format: 'iife',
  target: 'browser',
})
for (const log of buildWorker.logs) console.log(log)
const workerBody = await buildWorker.outputs[0].text()
content = content
  .replaceAll('export {', '{')
  .replace(
    '<WORKER_SOURCE_CODE>',
    workerBody.replace(/`/g, '\\`').replace(/\$\{/g, '\\${'),
  )
content = readFileSync('./script.txt').toString() + content
writeFileSync('dist.user.js', content)
