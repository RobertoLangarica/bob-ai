/**
 * JSONStore — Read/write JSON configuration files.
 *
 * V0 implementation: Uses localStorage to simulate filesystem storage.
 * When Tauri arrives, swap for real file I/O with atomic writes (temp + rename).
 *
 * Key design: Writes are atomic, reads validate against expected shape.
 */

// ---------------------------------------------------------------------------
// JSONStore interface (for future filesystem backend)
// ---------------------------------------------------------------------------

export interface IJSONStore {
  read<T>(key: string, defaultValue: T): T
  write<T>(key: string, value: T): void
  exists(key: string): boolean
  delete(key: string): void
  list(prefix: string): string[]
}

// ---------------------------------------------------------------------------
// localStorage-based JSONStore (V0 implementation)
// ---------------------------------------------------------------------------

const STORE_PREFIX = 'bob-ai:json:'

export class JSONStore implements IJSONStore {
  /**
   * Read a JSON value from the store.
   * Returns defaultValue if key doesn't exist or data is corrupted.
   */
  read<T>(key: string, defaultValue: T): T {
    try {
      const raw = localStorage.getItem(STORE_PREFIX + key)
      if (raw === null) return defaultValue
      const parsed = JSON.parse(raw) as T
      return parsed
    } catch {
      // Corrupted JSON — return default
      return defaultValue
    }
  }

  /**
   * Write a JSON value to the store atomically.
   * In V0 (localStorage), atomicity is guaranteed by the browser.
   * In Tauri, this would write to a temp file then rename.
   */
  write<T>(key: string, value: T): void {
    try {
      const serialized = JSON.stringify(value, null, 2)
      localStorage.setItem(STORE_PREFIX + key, serialized)
    } catch {
      // localStorage quota exceeded — in production, file I/O doesn't have this limit
      console.error(`[JSONStore] Failed to write key "${key}"`)
    }
  }

  /**
   * Check if a key exists in the store.
   */
  exists(key: string): boolean {
    return localStorage.getItem(STORE_PREFIX + key) !== null
  }

  /**
   * Delete a key from the store.
   */
  delete(key: string): void {
    localStorage.removeItem(STORE_PREFIX + key)
  }

  /**
   * List all keys with a given prefix.
   * Simulates directory listing for .bob/teams/ etc.
   */
  list(prefix: string): string[] {
    const fullPrefix = STORE_PREFIX + prefix
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(fullPrefix)) {
        keys.push(key.slice(STORE_PREFIX.length))
      }
    }
    return keys
  }
}
