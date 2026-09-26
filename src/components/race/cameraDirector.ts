import {
  DEFAULT_VIEW,
  VIEW_AERIAL,
  VIEW_CHASE,
  VIEW_ON_TRACK,
  type ViewMode,
} from './cameraViews'

export type ShotKind = 'aerial' | 'on-track' | 'chase'

/** Subject for aerial/chase: picked horse, else race leader. */
export function viewSubjectId(
  ids: Array<string | null | undefined> | null | undefined,
  followId: string | null | undefined,
  viewMode: ViewMode | null | undefined,
): string | null {
  const list = (ids || []).filter((id): id is string => Boolean(id))
  if (followId && list.includes(followId)) return followId
  if (viewMode === VIEW_AERIAL || viewMode === VIEW_CHASE) return list[0] || null
  return null
}

export function shotKind({
  viewMode,
}: {
  viewMode?: ViewMode | null
}): ShotKind {
  const mode = viewMode || DEFAULT_VIEW
  if (mode === VIEW_AERIAL) return 'aerial'
  if (mode === VIEW_CHASE) return 'chase'
  if (mode === VIEW_ON_TRACK) return 'on-track'
  return 'on-track'
}

export const SHOT_KINDS: ShotKind[] = ['aerial', 'on-track', 'chase']
