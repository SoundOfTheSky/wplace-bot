import { readFileSync, writeFileSync } from 'node:fs'

const build = await Bun.build({
  entrypoints: ['./src/bot.ts'],
  // sourcemap: 'inline',
  target: 'browser',
})
for (const log of build.logs) console.log(log)
let content = await build.outputs[0]!.text()
content = content.replace('export {', '{')
content = readFileSync('./script.txt').toString() + content
writeFileSync('dist.user.js', content)
