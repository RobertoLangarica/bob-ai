/**
 * Agent color assignments from neon palette.
 * Each agent gets a unique color for consistent identification
 * across orbital view, task streams, and chat.
 */
import { neon } from './theme'
import {
  IconLead, IconUI, IconBackend, IconResearch,
} from './icons'

export interface AgentDef {
  id: string
  name: string
  role: string
  icon: any
  color: string
}

export const agents: AgentDef[] = [
  { id: 'lead',     name: 'Team Lead',    role: 'Coordinator',  icon: IconLead,     color: neon.orange },
  { id: 'ui',       name: 'UI Developer', role: 'Frontend',     icon: IconUI,       color: neon.purple },
  { id: 'backend',  name: 'Backend Dev',  role: 'Backend',      icon: IconBackend,  color: neon.cyan },
  { id: 'research', name: 'Research',     role: 'Research',     icon: IconResearch, color: neon.green },
]

export function getAgentColor(id: string): string {
  return agents.find(a => a.id === id)?.color || '#505058'
}

export function getAgentDef(id: string): AgentDef | undefined {
  return agents.find(a => a.id === id)
}
