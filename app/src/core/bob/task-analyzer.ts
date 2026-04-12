/**
 * TaskAnalyzer — BoB's intelligence for classifying user messages.
 *
 * Analyzes user input to determine: what kind of task, which template,
 * and whether calibration conflicts exist.
 */

import type { WorkspaceCalibration } from '../types/calibration'
import type { TeamTemplate } from '../types/teams'
import { findMatchingSpecialists } from '../templates/specialist-catalog'

// ---------------------------------------------------------------------------
// Analysis result
// ---------------------------------------------------------------------------

export type TaskCategory =
  | 'build' // "Build a login page"
  | 'fix' // "Fix the auth bug"
  | 'refactor' // "Refactor the payment module"
  | 'research' // "Compare React vs Vue"
  | 'content' // "Write API documentation"
  | 'calibrate' // "Always use TypeScript strict"
  | 'meta' // "Show my teams" / "What can you do?"
  | 'ambiguous' // Can't determine intent

export interface TaskAnalysis {
  /** What category of task this is */
  category: TaskCategory
  /** Suggested template ID */
  suggestedTemplate: string | null
  /** Extracted key phrases */
  keywords: string[]
  /** Whether this conflicts with existing calibration */
  calibrationConflict: string | null
  /** Confidence (0-1) */
  confidence: number
}

// ---------------------------------------------------------------------------
// Keyword patterns for task classification
// ---------------------------------------------------------------------------

const CATEGORY_PATTERNS: Record<TaskCategory, RegExp[]> = {
  build: [
    /\b(build|create|implement|add|make|develop|set up|scaffold|design)\b/i,
    /\b(new feature|page|component|screen|view|form|button|modal)\b/i,
  ],
  fix: [
    /\b(fix|bug|broken|error|issue|crash|problem|doesn'?t work)\b/i,
    /\b(debug|troubleshoot|investigate error)\b/i,
  ],
  refactor: [
    /\b(refactor|clean up|reorganize|restructure|optimize|improve|simplify)\b/i,
    /\b(tech debt|performance|split|extract|rename)\b/i,
  ],
  research: [
    /\b(research|compare|evaluate|analyze|investigate|review options)\b/i,
    /\b(pros and cons|benchmark|trade-?offs|alternatives)\b/i,
  ],
  content: [
    /\b(write|document|readme|changelog|blog|article|guide)\b/i,
    /\b(documentation|docs|api docs|tutorial)\b/i,
  ],
  calibrate: [
    /\b(always|never|prefer|use .+ for|don'?t use|switch to)\b/i,
    /\b(style|convention|rule|standard|default)\b/i,
  ],
  meta: [
    /\b(show|list|status|what can|help|teams|agents|who)\b/i,
    /\b(how do|what is|tell me about)\b/i,
  ],
  ambiguous: [],
}

const TEMPLATE_HINTS: Record<string, string[]> = {
  'swe-team': [
    'build',
    'code',
    'implement',
    'feature',
    'bug',
    'test',
    'deploy',
    'api',
    'component',
    'database',
  ],
  'research-team': [
    'research',
    'compare',
    'analyze',
    'evaluate',
    'investigate',
    'benchmark',
    'review',
  ],
  'content-team': ['write', 'document', 'blog', 'article', 'guide', 'readme', 'changelog', 'docs'],
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze a user message to determine task category, suggested template,
 * and potential calibration conflicts.
 */
export function analyzeTask(
  message: string,
  calibration: WorkspaceCalibration,
  availableTemplates: TeamTemplate[],
): TaskAnalysis {
  const lower = message.toLowerCase()
  const keywords = extractKeywords(lower)

  // Classify category
  const { category, confidence } = classifyCategory(lower)

  // Suggest template
  const suggestedTemplate = suggestTemplate(lower, category, availableTemplates)

  // Check for calibration conflicts
  const calibrationConflict = detectCalibrationConflict(lower, calibration)

  return {
    category,
    suggestedTemplate,
    keywords,
    calibrationConflict,
    confidence,
  }
}

function classifyCategory(text: string): { category: TaskCategory; confidence: number } {
  let bestCategory: TaskCategory = 'ambiguous'
  let bestScore = 0

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(text)) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category as TaskCategory
    }
  }

  // Confidence: 0 matches = 0.2, 1 = 0.6, 2+ = 0.9
  const confidence = bestScore === 0 ? 0.2 : bestScore === 1 ? 0.6 : 0.9

  return { category: bestCategory, confidence }
}

function suggestTemplate(
  text: string,
  category: TaskCategory,
  templates: TeamTemplate[],
): string | null {
  // Category-based suggestion
  if (category === 'research') return 'research-team'
  if (category === 'content') return 'content-team'
  if (category === 'build' || category === 'fix' || category === 'refactor') return 'swe-team'

  // Keyword-based fallback
  for (const [templateId, hints] of Object.entries(TEMPLATE_HINTS)) {
    for (const hint of hints) {
      if (text.includes(hint)) {
        if (templates.some((t) => t.id === templateId)) {
          return templateId
        }
      }
    }
  }

  return null
}

function detectCalibrationConflict(text: string, calibration: WorkspaceCalibration): string | null {
  const workspaceType = calibration.workspace.type

  if (!workspaceType) return null

  // Web workspace + mobile task
  if (workspaceType.includes('web') && /\b(mobile|ios|android)\b/i.test(text)) {
    return `Workspace is calibrated for ${workspaceType}, but task mentions mobile.`
  }

  // Mobile workspace + web task
  if (workspaceType.includes('mobile') && /\b(web|browser|dashboard)\b/i.test(text)) {
    return `Workspace is calibrated for ${workspaceType}, but task mentions web.`
  }

  return null
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'and',
    'but',
    'or',
    'so',
    'that',
    'this',
    'it',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'they',
    'them',
    'their',
    'please',
    'want',
    'need',
  ])

  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 10) // max 10 keywords
}
