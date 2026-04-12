/**
 * Built-in team templates shipped with bob-ai V0.
 *
 * Three templates cover the most common use cases:
 * - SWE Team: build software
 * - Research Team: gather and analyze information
 * - Content Team: write documentation and content
 */

import type { TeamTemplate } from '../types/teams'
import { createDefaultAgentCalibration } from '../types/calibration'

const defaultCal = () => createDefaultAgentCalibration()

// ---------------------------------------------------------------------------
// SWE Team
// ---------------------------------------------------------------------------

export const sweTeamTemplate: TeamTemplate = {
  id: 'swe-team',
  name: 'SWE Team',
  description:
    'Software engineering team for building features, fixing bugs, and maintaining code quality.',
  version: '1.0.0',
  roles: [
    {
      id: 'lead',
      name: 'Team Lead',
      role: 'Coordinator',
      description:
        'Breaks down tasks, delegates to specialists, reviews results, reports milestones.',
      systemPromptTemplate:
        'You are the Team Lead. Your job is to analyze the task, break it into sub-tasks, delegate to specialist agents, and synthesize their results into a coherent outcome. You do not write code directly — you coordinate.',
      specializations: ['project-management'],
      tools: ['emit', 'debrief', 'spawn_agent', 'read_file', 'ask_lead'],
      defaultCalibration: {
        ...defaultCal(),
        decisionStyle: 'autonomous',
        progressReporting: 'milestone-based',
      },
    },
    {
      id: 'ui',
      name: 'UI Developer',
      role: 'Frontend',
      description: 'Builds user-facing components, screens, and visual features.',
      systemPromptTemplate:
        "You are a UI Developer. You build user-facing components, handle styling, layout, and user interactions. Follow the project's existing patterns and conventions.",
      specializations: ['web', 'mobile', 'desktop'],
      tools: ['emit', 'debrief', 'read_file', 'write_file', 'terminal', 'web_search'],
      defaultCalibration: defaultCal(),
    },
    {
      id: 'backend',
      name: 'Backend Developer',
      role: 'Backend',
      description: 'Builds APIs, databases, server logic, and infrastructure.',
      systemPromptTemplate:
        'You are a Backend Developer. You build server-side logic, APIs, database schemas, and infrastructure. Focus on reliability, security, and performance.',
      specializations: ['api', 'database', 'serverless', 'microservices'],
      tools: ['emit', 'debrief', 'read_file', 'write_file', 'terminal'],
      defaultCalibration: defaultCal(),
    },
    {
      id: 'reviewer',
      name: 'Code Reviewer',
      role: 'Quality',
      description: 'Reviews code changes for quality, security, and consistency.',
      systemPromptTemplate:
        'You are a Code Reviewer. You review code changes for bugs, security issues, performance problems, and consistency with project conventions. Be thorough but constructive.',
      specializations: ['security', 'performance', 'accessibility'],
      tools: ['emit', 'debrief', 'read_file', 'terminal'],
      defaultCalibration: {
        ...defaultCal(),
        decisionStyle: 'autonomous',
        progressReporting: 'completion-only',
      },
    },
  ],
  defaults: {
    goals: { platform: 'web', language: 'TypeScript' },
    constraints: ['Follow existing code patterns', 'Write tests for new functionality'],
    escalationRules: ['Ask before adding new dependencies', 'Ask before changing architecture'],
  },
  calibrationFlow: [
    {
      id: 'swe-platform',
      question: 'What kind of project?',
      category: 'platform',
      options: [
        { label: 'Web app', value: 'web' },
        { label: 'Mobile app', value: 'mobile' },
        { label: 'API / Backend', value: 'api' },
        { label: 'Library', value: 'library' },
        { label: 'Desktop app', value: 'desktop' },
      ],
      appliesTo: '*',
      defaultOption: 'web',
    },
    {
      id: 'swe-framework',
      question: 'Which framework?',
      category: 'framework',
      options: [
        { label: 'React', value: 'React' },
        { label: 'Vue', value: 'Vue' },
        { label: 'Svelte', value: 'Svelte' },
        { label: 'React Native', value: 'React Native' },
        { label: 'Next.js', value: 'Next.js' },
        { label: 'Other', value: 'other' },
      ],
      appliesTo: ['ui'],
    },
    {
      id: 'swe-testing',
      question: 'Testing approach?',
      category: 'testing',
      options: [
        { label: 'Full coverage', value: 'full-coverage' },
        { label: 'Critical paths only', value: 'critical-paths' },
        { label: 'Interaction tests', value: 'interaction-tests' },
        { label: 'None', value: 'none' },
      ],
      appliesTo: '*',
      defaultOption: 'critical-paths',
    },
    {
      id: 'swe-deps',
      question: 'How should agents handle new dependencies?',
      category: 'dependencies',
      options: [
        { label: 'Always ask first', value: 'Always ask before adding new dependencies' },
        { label: 'Auto-add if popular', value: 'Auto-add popular packages, ask for obscure ones' },
        {
          label: 'Never add without asking',
          value: 'Never add any dependency without explicit approval',
        },
      ],
      appliesTo: '*',
      defaultOption: 'Always ask before adding new dependencies',
    },
  ],
}

// ---------------------------------------------------------------------------
// Research Team
// ---------------------------------------------------------------------------

export const researchTeamTemplate: TeamTemplate = {
  id: 'research-team',
  name: 'Research Team',
  description: 'Information gathering, analysis, and synthesis team.',
  version: '1.0.0',
  roles: [
    {
      id: 'lead',
      name: 'Research Lead',
      role: 'Coordinator',
      description: 'Plans research strategy, delegates queries, synthesizes findings.',
      systemPromptTemplate:
        'You are the Research Lead. Plan the research strategy, delegate specific research tasks to your team, and synthesize findings into a coherent analysis.',
      specializations: ['project-management'],
      tools: ['emit', 'debrief', 'spawn_agent', 'read_file'],
      defaultCalibration: { ...defaultCal(), decisionStyle: 'autonomous' },
    },
    {
      id: 'analyst',
      name: 'Analyst',
      role: 'Analysis',
      description: 'Deep-dives into topics, reads documentation, extracts insights.',
      systemPromptTemplate:
        'You are a Research Analyst. Deep-dive into assigned topics, read documentation and sources carefully, and extract actionable insights.',
      specializations: ['data-analysis', 'competitive-analysis'],
      tools: ['emit', 'debrief', 'read_file', 'write_file', 'web_search', 'web_scrape'],
      defaultCalibration: defaultCal(),
    },
    {
      id: 'scout',
      name: 'Scout',
      role: 'Discovery',
      description: 'Searches the web, finds relevant sources, summarizes content.',
      systemPromptTemplate:
        'You are a Research Scout. Search the web for relevant sources, evaluate their quality, and provide concise summaries of key findings.',
      specializations: ['web-research'],
      tools: ['emit', 'debrief', 'web_search', 'web_scrape', 'write_file'],
      defaultCalibration: { ...defaultCal(), progressReporting: 'verbose' },
    },
  ],
  defaults: {
    goals: {},
    constraints: ['Cite sources for all claims', 'Distinguish between facts and opinions'],
    escalationRules: ['Ask before narrowing scope', 'Ask if sources seem unreliable'],
  },
  calibrationFlow: [
    {
      id: 'res-depth',
      question: 'Research depth?',
      category: 'code-style',
      options: [
        { label: 'Quick overview', value: 'Quick overview — surface-level scan' },
        { label: 'Standard analysis', value: 'Standard analysis — thorough review' },
        { label: 'Deep dive', value: 'Deep dive with primary sources' },
      ],
      appliesTo: '*',
      defaultOption: 'Standard analysis — thorough review',
    },
    {
      id: 'res-format',
      question: 'Output format?',
      category: 'code-style',
      options: [
        { label: 'Bullet points', value: 'Bullet point summaries' },
        { label: 'Structured report', value: 'Structured report with sections' },
        { label: 'Comparison table', value: 'Comparison table format' },
      ],
      appliesTo: '*',
      defaultOption: 'Structured report with sections',
    },
  ],
}

// ---------------------------------------------------------------------------
// Content Team
// ---------------------------------------------------------------------------

export const contentTeamTemplate: TeamTemplate = {
  id: 'content-team',
  name: 'Content Team',
  description: 'Documentation, blog posts, marketing copy, and technical writing.',
  version: '1.0.0',
  roles: [
    {
      id: 'lead',
      name: 'Content Lead',
      role: 'Coordinator',
      description: 'Plans content strategy, delegates writing tasks, reviews quality.',
      systemPromptTemplate:
        'You are the Content Lead. Plan the content structure, delegate writing tasks, and ensure quality and consistency across all deliverables.',
      specializations: ['project-management'],
      tools: ['emit', 'debrief', 'spawn_agent', 'read_file'],
      defaultCalibration: { ...defaultCal(), decisionStyle: 'autonomous' },
    },
    {
      id: 'writer',
      name: 'Technical Writer',
      role: 'Writing',
      description: 'Writes technical documentation, guides, and articles.',
      systemPromptTemplate:
        'You are a Technical Writer. Write clear, well-structured documentation and articles. Follow the project style guide and target audience guidelines.',
      specializations: ['documentation', 'blog', 'marketing'],
      tools: ['emit', 'debrief', 'read_file', 'write_file', 'web_search'],
      defaultCalibration: defaultCal(),
    },
    {
      id: 'editor',
      name: 'Editor',
      role: 'Review',
      description: 'Reviews content for clarity, grammar, and consistency.',
      systemPromptTemplate:
        'You are an Editor. Review content for clarity, accuracy, grammar, and consistency. Suggest improvements constructively.',
      specializations: ['copyediting', 'style-guide'],
      tools: ['emit', 'debrief', 'read_file', 'write_file'],
      defaultCalibration: { ...defaultCal(), progressReporting: 'completion-only' },
    },
    {
      id: 'researcher',
      name: 'Research Assistant',
      role: 'Research',
      description: 'Gathers background information for content creation.',
      systemPromptTemplate:
        'You are a Research Assistant for content creation. Find relevant background information, examples, and data to support the writing team.',
      specializations: ['web-research'],
      tools: ['emit', 'debrief', 'web_search', 'web_scrape', 'write_file'],
      defaultCalibration: defaultCal(),
    },
  ],
  defaults: {
    goals: {},
    constraints: ['Maintain consistent tone throughout', 'Follow style guide'],
    escalationRules: [
      'Ask about target audience if unclear',
      'Ask before changing document structure',
    ],
  },
  calibrationFlow: [
    {
      id: 'cnt-tone',
      question: 'Writing tone?',
      category: 'code-style',
      options: [
        { label: 'Technical', value: 'Technical and precise' },
        { label: 'Conversational', value: 'Conversational and approachable' },
        { label: 'Formal', value: 'Formal and professional' },
      ],
      appliesTo: ['writer', 'editor'],
      defaultOption: 'Technical and precise',
    },
  ],
}

// ---------------------------------------------------------------------------
// All built-in templates
// ---------------------------------------------------------------------------

export const builtInTemplates: TeamTemplate[] = [
  sweTeamTemplate,
  researchTeamTemplate,
  contentTeamTemplate,
]
