/**
 * TemplateStore — loads templates from built-in and custom (.bob/teams/) sources.
 */

import type { JSONStore } from '../storage/json-store'
import { StorageKeys } from '../storage/storage-init'
import type { TeamTemplate } from '../types/teams'
import { builtInTemplates } from './built-in-templates'

export class TemplateStore {
  constructor(private readonly json: JSONStore) {}

  /** List all available templates (built-in + custom). Custom overrides built-in on same ID. */
  listAll(): TeamTemplate[] {
    const customKeys = this.json.list(StorageKeys.TEAMS_PREFIX)
    const customTemplates: TeamTemplate[] = customKeys
      .map((key) => this.json.read<TeamTemplate | null>(key, null))
      .filter((t): t is TeamTemplate => t !== null)

    const customIds = new Set(customTemplates.map((t) => t.id))
    const builtIns = builtInTemplates.filter((t) => !customIds.has(t.id))

    return [...builtIns, ...customTemplates]
  }

  /** Get a template by ID (custom first, then built-in). */
  getById(id: string): TeamTemplate | null {
    const customKey = StorageKeys.TEAMS_PREFIX + id
    if (this.json.exists(customKey)) {
      return this.json.read<TeamTemplate | null>(customKey, null)
    }
    return builtInTemplates.find((t) => t.id === id) ?? null
  }

  /** Save a custom template. */
  save(template: TeamTemplate): void {
    this.json.write(StorageKeys.TEAMS_PREFIX + template.id, template)
  }

  /** Delete a custom template (cannot delete built-ins). */
  delete(id: string): boolean {
    const key = StorageKeys.TEAMS_PREFIX + id
    if (this.json.exists(key)) {
      this.json.delete(key)
      return true
    }
    return false
  }
}
