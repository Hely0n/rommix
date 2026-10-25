import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { dolphinGameId } from './dolphin-saves.ts'
import type { SaveEnvironment } from './savepaths.ts'

/**
 * Reading the game id a disc declares out of each container Dolphin plays.
 *
 * The id is what Dolphin names a state after, so a wrong one is a state pushed
 * under this game that belongs to another — and none at all is a state that
 * never syncs. Byte offsets are the whole of it, which is why each container
 * is built here by hand.
 */

const GAMECUBE = '\xc2\x33\x9f\x3d'
const WII = '\x5d\x1c\x9e\xa3'

/** A disc header: the id, then the console's magic word where it sits. */
function disc(id: string, console: 'gc' | 'wii'): string {
  return console === 'gc'
    ? id.padEnd(0x1c, '\0') + GAMECUBE
    : id.padEnd(0x18, '\0') + WII + '\0\0\0\0'
}

/** A machine holding one file, read through `head` as the descriptors read it. */
function reading(bytes: string): SaveEnvironment {
  return { head: (_path, length) => bytes.slice(0, length) } as SaveEnvironment
}

const id = (bytes: string): string | null => dolphinGameId(reading(bytes), '/roms/game')

describe('the game id of a disc', () => {
  test('from a plain image, which starts with the header', () => {
    assert.equal(id(disc('GALE01', 'gc')), 'GALE01')
    assert.equal(id(disc('RSBE01', 'wii')), 'RSBE01')
  })

  test('from RVZ and WIA, which copy it into their second header', () => {
    assert.equal(id('RVZ\x01'.padEnd(0x58, '\0') + disc('RSBE01', 'wii')), 'RSBE01')
    assert.equal(id('WIA\x01'.padEnd(0x58, '\0') + disc('GALE01', 'gc')), 'GALE01')
  })

  test('from WBFS, one of its own sectors in', () => {
    // The sector size is a power of two, its exponent at byte 8.
    const wbfs = 'WBFS\0\0\0\0\x09'.padEnd(0x200, '\0') + disc('RSBE01', 'wii')
    assert.equal(id(wbfs), 'RSBE01')
  })

  test('from CISO, after its block map', () => {
    assert.equal(id('CISO'.padEnd(0x8000, '\0') + disc('GALE01', 'gc')), 'GALE01')
  })

  test('and none from a header with no disc magic in it', () => {
    // GCZ compresses the header along with the rest, so what is there is noise
    // that may well start with six letters.
    assert.equal(id('\x01\xc0\x0b\xb1GALE01'.padEnd(0x40, '\0')), null)
    assert.equal(id('GALE01'.padEnd(0x40, '\0')), null)
  })

  test('and none from a file that cannot be read', () => {
    const missing = { head: () => null } as unknown as SaveEnvironment
    assert.equal(dolphinGameId(missing, '/roms/game.iso'), null)
  })
})
