/**
 * Specialist Catalog — keyword-based matching of task requirements to specialists.
 */

import type { SpecialistEntry } from '../types/teams'

export const specialistCatalog: SpecialistEntry[] = [
  // UI Specialists
  {
    id: 'web-ui',
    baseRole: 'ui',
    name: 'Web UI Developer',
    description: 'Specializes in browser-based web applications.',
    keywords: ['web', 'browser', 'spa', 'website', 'webapp'],
    frameworks: ['React', 'Vue', 'Svelte', 'Next.js', 'Nuxt'],
    calibrationDefaults: { specialization: 'web' },
  },
  {
    id: 'mobile-ui',
    baseRole: 'ui',
    name: 'Mobile UI Developer',
    description: 'Specializes in iOS and Android mobile applications.',
    keywords: ['mobile', 'ios', 'android', 'app', 'phone', 'tablet'],
    frameworks: ['React Native', 'Flutter', 'Swift', 'Kotlin'],
    calibrationDefaults: { specialization: 'mobile' },
  },
  {
    id: 'desktop-ui',
    baseRole: 'ui',
    name: 'Desktop UI Developer',
    description: 'Specializes in desktop applications.',
    keywords: ['desktop', 'electron', 'tauri', 'native'],
    frameworks: ['Electron', 'Tauri'],
    calibrationDefaults: { specialization: 'desktop' },
  },
  // Backend Specialists
  {
    id: 'api-backend',
    baseRole: 'backend',
    name: 'API Developer',
    description: 'Specializes in REST and GraphQL APIs.',
    keywords: ['api', 'rest', 'graphql', 'endpoint', 'server'],
    frameworks: ['Express', 'Fastify', 'NestJS', 'Django', 'FastAPI'],
    calibrationDefaults: { specialization: 'api' },
  },
  {
    id: 'db-backend',
    baseRole: 'backend',
    name: 'Database Engineer',
    description: 'Specializes in database design, schemas, and migrations.',
    keywords: ['database', 'schema', 'migration', 'sql', 'postgres', 'mongo'],
    frameworks: ['PostgreSQL', 'MongoDB', 'Prisma', 'Drizzle'],
    calibrationDefaults: { specialization: 'database' },
  },
  {
    id: 'infra-backend',
    baseRole: 'backend',
    name: 'Infrastructure Engineer',
    description: 'Specializes in deployment, CI/CD, and infrastructure.',
    keywords: ['deploy', 'ci/cd', 'docker', 'kubernetes', 'infra', 'devops'],
    frameworks: ['Docker', 'Kubernetes', 'Terraform', 'GitHub Actions'],
    calibrationDefaults: { specialization: 'infrastructure' },
  },
  // Non-Coding Specialists
  {
    id: 'researcher',
    baseRole: 'analyst',
    name: 'Research Analyst',
    description: 'Specializes in information gathering and analysis.',
    keywords: ['research', 'analyze', 'compare', 'evaluate', 'investigate'],
    frameworks: [],
    calibrationDefaults: { specialization: 'research' },
  },
  {
    id: 'writer',
    baseRole: 'analyst',
    name: 'Technical Writer',
    description: 'Specializes in documentation and technical writing.',
    keywords: ['document', 'write', 'readme', 'guide', 'docs', 'article'],
    frameworks: [],
    calibrationDefaults: { specialization: 'writing' },
  },
  {
    id: 'designer',
    baseRole: 'analyst',
    name: 'UX Designer',
    description: 'Specializes in user experience and interface design.',
    keywords: ['design', 'wireframe', 'ux', 'ui', 'user flow', 'mockup'],
    frameworks: [],
    calibrationDefaults: { specialization: 'design' },
  },
]

/**
 * Find matching specialists for a task description and workspace type.
 */
export function findMatchingSpecialists(
  taskDescription: string,
  workspaceType?: string,
): SpecialistEntry[] {
  const text = `${taskDescription} ${workspaceType ?? ''}`.toLowerCase()
  const matches: Array<{ entry: SpecialistEntry; score: number }> = []

  for (const entry of specialistCatalog) {
    let score = 0
    for (const keyword of entry.keywords) {
      if (text.includes(keyword.toLowerCase())) score++
    }
    for (const fw of entry.frameworks) {
      if (text.includes(fw.toLowerCase())) score += 2 // framework matches score higher
    }
    if (score > 0) matches.push({ entry, score })
  }

  return matches.sort((a, b) => b.score - a.score).map((m) => m.entry)
}

/**
 * Find the best specialist for a given base role and context.
 */
export function findSpecialistForRole(
  baseRole: string,
  taskDescription: string,
  workspaceType?: string,
): SpecialistEntry | null {
  const matches = findMatchingSpecialists(taskDescription, workspaceType)
  return matches.find((m) => m.baseRole === baseRole) ?? null
}
