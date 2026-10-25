import type { Text } from '@shared/i18n'
import { directory, joinPath, perGameId, shared } from './savepaths.ts'
import type { SaveContext, SaveEnvironment, SaveLocation, SavePaths } from './savepaths.ts'

/**
 * The game id a GameCube or Wii disc declares, which Dolphin names its save
 * states after: `StateSaves/RSBE01.s01`.
 *
 * Nothing in that name is the ROM's, but the id is the first six bytes of the
 * disc header, and most image formats Dolphin plays keep that header near the
 * front of the file — so a short read finds it without the emulator running.
 * Where the header sits depends on the container:
 *
 *  - a plain image (`.iso`, `.gcm`, NKit) starts with it;
 *  - RVZ and WIA keep it uncompressed in their second header, after the
 *    fixed-size first one and four 32-bit fields;
 *  - WBFS keeps it one hard-disk sector in, the sector size being a power of
 *    two given in its own header;
 *  - CISO keeps it right after its fixed block map.
 *
 * GCZ is not read: it compresses the header with everything else. An id that
 * cannot be read is null rather than a guess — a state written back under
 * another game's id is a state that game loads.
 */

/** How much to read: enough for the furthest header, CISO's, and the magic in it. */
const HEAD_BYTES = 0x8000 + 0x20

/** Where the copy of the disc header starts in RVZ and WIA. */
const WIA_DISC_HEADER = 0x58
/** Where CISO's block map ends and the disc begins. */
const CISO_DATA = 0x8000

/** The magic words a disc header carries, as latin1, and where. */
const WII_MAGIC = { at: 0x18, bytes: '\x5d\x1c\x9e\xa3' }
const GAMECUBE_MAGIC = { at: 0x1c, bytes: '\xc2\x33\x9f\x3d' }

/** Six characters: system, two of title, region, two of maker. */
const GAME_ID = /^[A-Z0-9]{6}$/

export function dolphinGameId(env: SaveEnvironment, romPath: string): string | null {
  const head = env.head(romPath, HEAD_BYTES)
  if (!head) return null
  const header = discHeader(head)
  if (header === null) return null

  const isDisc = [WII_MAGIC, GAMECUBE_MAGIC].some(
    ({ at, bytes }) => header.slice(at, at + bytes.length) === bytes
  )
  const id = header.slice(0, 6)
  return isDisc && GAME_ID.test(id) ? id : null
}

/** The disc header inside a container, from wherever the container keeps it. */
function discHeader(head: string): string | null {
  const magic = head.slice(0, 4)
  if (magic === 'RVZ\x01' || magic === 'WIA\x01') return head.slice(WIA_DISC_HEADER)
  if (magic === 'WBFS') {
    const sectorShift = head.charCodeAt(8)
    return sectorShift < 16 ? head.slice(1 << sectorShift) : null
  }
  if (magic === 'CISO') return head.slice(CISO_DATA)
  return head
}

/**
 * Dolphin's states for this game: the files in `dir` named after its game id,
 * or no location where the id cannot be read.
 */
export function dolphinStates(
  ctx: SaveContext,
  dir: string,
  search?: readonly string[]
): SaveLocation | null {
  const id = dolphinGameId(ctx.env, ctx.romPath)
  return id ? perGameId(dir, id, search) : null
}

/** The title type the Wii gives a game booted from a disc. */
const DISC_TITLE_TYPE = '00010000'

/**
 * The NAND folder a Wii disc game's title id names: the first four characters
 * of its game id as hex, lowercase as Dolphin writes it — `RSBE01` is `52534245`.
 */
export function wiiTitleFolder(gameId: string): string {
  return Array.from(gameId.slice(0, 4), (char) =>
    char.charCodeAt(0).toString(16).padStart(2, '0')
  ).join('')
}

/** A Wii disc game's own NAND folder, synced whole; anything else stays shared. */
export function dolphinSaves(
  ctx: SaveContext,
  wiiRoot: string | null,
  cards: string | null,
  reason: Text
): Pick<SavePaths, 'saves' | 'unsyncableReason'> {
  const id = ctx.system === 'wii' && wiiRoot ? dolphinGameId(ctx.env, ctx.romPath) : null
  if (id && wiiRoot) {
    return {
      saves: directory(joinPath(wiiRoot, 'title', DISC_TITLE_TYPE, wiiTitleFolder(id), 'data'))
    }
  }
  return { saves: cards ? shared(cards) : null, unsyncableReason: reason }
}
