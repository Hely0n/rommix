import type { RomQuery, RommRom, RommSiblingRom } from '@shared/types'

/**
 * Which version stands for a game, and who chose it.
 *
 * The version a grouped grid shows and opens is either the one this user
 * marked in RomM or, with none marked, the one RomM picks by its own order.
 * The mark is on every row; RomM's pick is on none, so it is asked for the way
 * the grid asks and found among what comes back. Kept out of the tab so it can
 * be tested without a screen. See `VersionsTab`.
 */

/** The version this user marked in RomM, if any. */
export function markedVersion(
  rom: RommRom,
  siblings: readonly RommSiblingRom[]
): number | undefined {
  if (rom.rom_user.is_main_sibling) return rom.id
  return siblings.find((sibling) => sibling.is_main_sibling)?.id
}

/**
 * The grouped list that has RomM's pick for this game in it.
 *
 * Narrowed by name: every version of a game shares the name its metadata gives
 * it, so the search keeps the whole group and the grouping still has all of
 * them to choose from.
 */
export function pickQuery(rom: RommRom): RomQuery {
  return {
    group_by_meta_id: true,
    platform_ids: [rom.platform_id],
    search_term: rom.name ?? rom.fs_name_no_tags
  }
}

/** The version of this game a grouped list returned, if it returned one. */
export function pickedVersion(
  items: readonly Pick<RommRom, 'id'>[],
  rom: RommRom,
  siblings: readonly RommSiblingRom[]
): number | null {
  const group = new Set([rom.id, ...siblings.map((sibling) => sibling.id)])
  return items.find((item) => group.has(item.id))?.id ?? null
}
