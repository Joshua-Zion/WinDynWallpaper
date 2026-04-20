const fs = require('fs')
const c = fs.readFileSync('D:/Projects/WinDynWallpaper/src/main/index.ts', 'utf8')
const logCount = (c.match(/console\.log\(/g) || []).length
const errCount = (c.match(/console\.error\(/g) || []).length
console.log('console.log:', logCount, 'console.error:', errCount)
if (logCount > 3) {
  const matches = c.match(/console\.log\([^)]+\)/g)
  console.log('All console.log:')
  matches.forEach(m => console.log(' ', m))
}
