import { DEFAULT_GEOMETRY, DEFAULT_PRINT, DEFAULT_SETTINGS, isPrintSettings, validateSettings } from '../core/settings';
import type { Geometry, PresetId, PrintSettings, ProcessingSettings } from '../core/types';

export interface EditorState {
  settings: ProcessingSettings;
  geometry: Geometry;
  preset: PresetId | null;
  print: PrintSettings;
}
export type EditorAction =
  | { type: 'adjust'; patch: Partial<ProcessingSettings> }
  | { type: 'preset'; preset: PresetId; settings: ProcessingSettings }
  | { type: 'geometry'; geometry: Geometry }
  | { type: 'print'; print: PrintSettings }
  | { type: 'reset' }
  | { type: 'new-document' };

export const STORAGE_KEY = 'document-enhancer.preferences.v1';
export function initialEditorState(): EditorState {
  return { settings: { ...DEFAULT_SETTINGS }, geometry: structuredClone(DEFAULT_GEOMETRY), preset: null, print: { ...DEFAULT_PRINT } };
}
export function loadPreferences(): EditorState {
  const state = initialEditorState();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.settings) { validateSettings(stored.settings); state.settings = { ...DEFAULT_SETTINGS, ...stored.settings }; }
    if (isPrintSettings(stored?.print)) state.print = stored.print;
  } catch { /* Unavailable storage or obsolete/invalid preferences use safe defaults. */ }
  return state;
}
export function savePreferences(state: EditorState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: state.settings, print: state.print })); }
  catch { /* Private browsing and full storage must not prevent editing. */ }
}
export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'adjust': return { ...state, settings: { ...state.settings, ...action.patch }, preset: null };
    case 'preset': return { ...state, settings: { ...action.settings }, preset: action.preset };
    case 'geometry': return { ...state, geometry: action.geometry };
    case 'print': return { ...state, print: action.print };
    case 'reset': return { ...initialEditorState(), print: state.print };
    case 'new-document': return { ...state, geometry: structuredClone(DEFAULT_GEOMETRY), preset: null };
  }
}
