import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PR_NUMBER = process.argv[2] || 'local'
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots', `pr-${PR_NUMBER}`)
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173'

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })

const VIEWS_TO_CAPTURE = [
  { name: 'home', path: '/', description: 'Home / Team List' },
  { name: 'team-config', path: '/team/new', description: 'Team Configuration' },
  { name: 'chat', path: '/team/demo/chat', description: 'Chat Interface' },
  { name: 'workflow', path: '/team/demo/workflow', description: 'Workflow Builder' },
  { name: 'activity', path: '/team/demo/activity', description: 'Activity Monitor' },
  { name: 'knowledge', path: '/team/demo/knowledge', description: 'Knowledge Base' },
]

async function captureScreenshots() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const results = []

  for (const view of VIEWS_TO_CAPTURE) {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    try {
      console.log(`📸 Capturing ${view.name}...`)
      await page.goto(`${BASE_URL}${view.path}`, {
        waitUntil: 'networkidle0',
        timeout: 15000,
      })

      // Brief pause for any animations to settle
      await new Promise((r) => setTimeout(r, 1000))

      const screenshotPath = path.join(SCREENSHOT_DIR, `${view.name}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: false })

      results.push({
        name: view.name,
        description: view.description,
        path: screenshotPath,
        success: true,
      })

      console.log(`  ✅ ${view.name} captured`)
    } catch (error) {
      console.error(`  ❌ Failed: ${view.name} — ${error.message}`)
      results.push({
        name: view.name,
        description: view.description,
        success: false,
        error: error.message,
      })
    } finally {
      await page.close()
    }
  }

  await browser.close()
  generateReport(results)

  const succeeded = results.filter((r) => r.success).length
  console.log(`\nDone: ${succeeded}/${results.length} screenshots captured`)
}

function generateReport(results) {
  const reportDir = path.join(__dirname, '..', 'screenshots')
  fs.mkdirSync(reportDir, { recursive: true })
  const reportPath = path.join(reportDir, 'report.md')

  let report = `## 📸 UI Screenshots for PR #${PR_NUMBER}\n\n`
  report += `Generated: ${new Date().toISOString()}\n\n`

  for (const result of results) {
    if (result.success) {
      report += `### ${result.description}\n`
      report += `\`${result.name}\`\n\n`
      report += `![${result.name}](pr-${PR_NUMBER}/${result.name}.png)\n\n`
    } else {
      report += `### ❌ ${result.description}\n`
      report += `Could not capture: ${result.error}\n\n`
    }
  }

  fs.writeFileSync(reportPath, report)
  console.log(`\n📝 Report: ${reportPath}`)
}

captureScreenshots().catch((err) => {
  console.error('Screenshot generation failed:', err)
  process.exit(1)
})
