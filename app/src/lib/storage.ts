import type { AppState, AppRecord, ImportLogEntry } from '../types/app';
import type { ActionItem } from '../types/features';

const STORAGE_KEY = 'revenue_intelligence_inbox_v1';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE: AppState = {
  records: [],
  import_log: [],
  schema_version: SCHEMA_VERSION,
};

// Separate key for persisted action states (user manual changes to actions)
const ACTIONS_KEY = 'revenue_intelligence_actions_v1';

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schema_version !== SCHEMA_VERSION) {
      console.warn('Schema version mismatch, resetting state');
      return { ...DEFAULT_STATE };
    }
    return parsed;
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state to localStorage', e);
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getRecords(): AppRecord[] {
  return loadState().records;
}

export function getImportLog(): ImportLogEntry[] {
  return loadState().import_log;
}

export function saveRecordsAndLog(records: AppRecord[], importLog: ImportLogEntry[]): void {
  saveState({ records, import_log: importLog, schema_version: SCHEMA_VERSION });
}

// ── Persisted action states ────────────────────────────────────────────────────

export function loadActionStates(): Map<string, ActionItem> {
  try {
    const raw = localStorage.getItem(ACTIONS_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, ActionItem>;
    return new Map(Object.entries(parsed));
  } catch (e) {
    console.error('Failed to load action states', e);
    return new Map();
  }
}

export function saveActionStates(actions: Map<string, ActionItem>): void {
  try {
    const obj = Object.fromEntries(actions.entries());
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save action states', e);
  }
}
