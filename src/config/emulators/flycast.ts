import type { Text } from '@shared/i18n'
import { baseName, dirName, joinPath, named, shared } from './savepaths.ts'
import type { SaveContext, SaveLocation } from './savepaths.ts'

/**
 * Where Flycast's libretro core keeps a Dreamcast game's save.
 *
 * A Dreamcast save lives on a VMU, and which file stands for the VMU is the
 * core's `per_content_vmus` option. Transcribed from `getVmuPath` in Flycast's
 * `shell/libretro/oslib.cpp`:
 *
 *  - off, the core's default and what RetroDECK ships: every game shares
 *    `<system>/dc/vmu_save_A1.bin`, so there is nothing to sync per game;
 *  - "VMU A1" or "All VMUs": the first card is `<product number>.A1.bin` in the
 *    save directory, named after the disc rather than the ROM file.
 *
 * Only the first card is synced, including where every card is per game: A1 is
 * the one a game saves to unless the player chooses another.
 *
 * The product number is read off the disc's boot sector, the way Flycast reads
 * it. A file named after the ROM is still opened where no product-number file
 * exists — the name older Flycast builds wrote — but every save is written
 * under the product number, so that is the only name worth matching.
 */
export function flycastVmu(
  ctx: SaveContext,
  savesDir: string | null,
  options: { perContent: string | null; systemDir: string | null }
): { saves: SaveLocation | null; unsyncableReason?: Text } {
  if (options.perContent !== 'VMU A1' && options.perContent !== 'All VMUs') {
    return {
      saves: options.systemDir ? shared(joinPath(options.systemDir, 'dc')) : null,
      unsyncableReason: 'saves.flycastSharedVmu'
    }
  }
  if (!savesDir) return { saves: null }

  const product = productNumber(ctx)
  if (!product) return { saves: shared(savesDir), unsyncableReason: 'saves.flycastProductNumber' }
  return { saves: named(savesDir, `${product}.A1.bin`) }
}

/** What a Dreamcast boot sector starts with. */
const IP_SIGNATURE = 'SEGA SEGAKATANA'
/** Where the product number sits in the boot sector, and how long it is. */
const PRODUCT_OFFSET = 0x40
const PRODUCT_LENGTH = 10
/**
 * Where the boot sector can start in a track file: a cooked sector, a raw
 * Mode 1 sector behind its sync and header, a raw Mode 2 sector behind its
 * subheader as well.
 */
const SECTOR_OFFSETS = [0, 16, 24]
/** Characters Flycast replaces with `_` in the file name it builds. */
const INVALID_CHARS = /[ /\\:*?|<>]/g

/**
 * The disc's product number, as Flycast spells it into a file name.
 *
 * Read from the track a `.cue` or `.gdi` points at, because those are tracks on
 * disk as they were on the disc. A compressed image — CHD, CDI — cannot be read
 * without decompressing it, so it gets null, and so does a track that turns out
 * not to start with a boot sector: a name built from the wrong bytes would be a
 * save written where Flycast never opens it.
 */
function productNumber(ctx: SaveContext): string | null {
  const track = bootTrack(ctx)
  if (!track) return null
  const head = ctx.env.head(track, 2352)
  if (!head) return null

  for (const offset of SECTOR_OFFSETS) {
    if (head.slice(offset, offset + IP_SIGNATURE.length) !== IP_SIGNATURE) continue
    const start = offset + PRODUCT_OFFSET
    // Up to the first NUL, then trailing whitespace off — as Flycast trims it.
    const raw = head
      .slice(start, start + PRODUCT_LENGTH)
      .split('\0')[0]
      .trimEnd()
    return raw ? raw.replace(INVALID_CHARS, '_') : null
  }
  return null
}

/**
 * The track file the boot sector is in.
 *
 * A GD-ROM boots from the first data track of its high-density area, which a
 * Redump `.cue` marks with a `REM` and a `.gdi` places from sector 45000. A disc
 * with no such area is a CD, booted from its first data track.
 */
function bootTrack(ctx: SaveContext): string | null {
  const text = ctx.env.text(ctx.romPath)
  if (text == null) return null
  const lower = ctx.romPath.toLowerCase()
  const tracks = lower.endsWith('.cue')
    ? cueTracks(text)
    : lower.endsWith('.gdi')
      ? gdiTracks(text)
      : []
  const chosen = tracks.find((track) => track.highDensity) ?? tracks[0]
  return chosen ? joinPath(dirName(ctx.romPath), baseName(chosen.file)) : null
}

interface DataTrack {
  file: string
  highDensity: boolean
}

/** The data tracks a `.cue` lists, each with the file it starts in. */
function cueTracks(text: string): DataTrack[] {
  const tracks: DataTrack[] = []
  let file: string | null = null
  let fileUsed = false
  let highDensity = false

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*REM\s+HIGH-DENSITY AREA/i.test(line)) highDensity = true
    const fileMatch = /^\s*FILE\s+"([^"]+)"/i.exec(line)
    if (fileMatch) {
      file = fileMatch[1]
      fileUsed = false
      continue
    }
    const trackMatch = /^\s*TRACK\s+\d+\s+(\S+)/i.exec(line)
    if (!trackMatch || !file) continue
    // A track that shares its file with the one before starts partway in,
    // where reading the head of the file would find the wrong sector.
    if (!fileUsed && trackMatch[1].toUpperCase() !== 'AUDIO') {
      tracks.push({ file, highDensity })
    }
    fileUsed = true
  }
  return tracks
}

/** The data tracks a `.gdi` lists: `<number> <lba> <type> <size> <file> <offset>`. */
function gdiTracks(text: string): DataTrack[] {
  const tracks: DataTrack[] = []
  for (const line of text.split(/\r?\n/).slice(1)) {
    const match = /^\s*\d+\s+(\d+)\s+(\d+)\s+\d+\s+("[^"]+"|\S+)/.exec(line)
    // Type 4 is data, 0 is audio.
    if (!match || match[2] !== '4') continue
    tracks.push({ file: match[3].replace(/^"|"$/g, ''), highDensity: Number(match[1]) >= 45000 })
  }
  return tracks
}
