export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';
export type EditMode = 'edit' | 'preview';

export interface AppState {
  isDirty: boolean;
  autoSaveEnabled: boolean;
  currentZoom: number;
  viewport: ViewportMode;
  mode: EditMode;
  saveStatus: SaveStatus;
}

const state: AppState = {
  isDirty: false,
  autoSaveEnabled: true,
  currentZoom: 1.0,
  viewport: 'desktop',
  mode: 'edit',
  saveStatus: 'saved'
};

export function getState(): Readonly<AppState> {
  return state;
}

export function updateState(partial: Partial<AppState>): void {
  Object.assign(state, partial);
}
