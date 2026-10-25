import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import type { RommRom, RommSiblingRom } from '@shared/types'
import { markedVersion, pickedVersion, pickQuery } from './versions.ts'

/**
 * Which version stands for a game, and who chose it.
 *
 * The two answers are drawn as different labels, so mixing them up is a row
 * telling somebody they chose a version they never touched.
 */

function rom(id: number, marked = false): RommRom {
  return {
    id,
    name: 'Cave Story',
    fs_name_no_tags: 'cavestory',
    platform_id: 3,
    rom_user: { is_main_sibling: marked }
  } as unknown as RommRom
}

function sibling(id: number, marked = false): RommSiblingRom {
  return { id, is_main_sibling: marked } as RommSiblingRom
}

describe('the version this user marked', () => {
  test('is the one open, where it carries the mark', () => {
    assert.equal(markedVersion(rom(1, true), [sibling(2)]), 1)
  })

  test('or the sibling that carries it', () => {
    assert.equal(markedVersion(rom(1), [sibling(2), sibling(3, true)]), 3)
  })

  test('and nothing where none is marked, which is RomM’s pick to name', () => {
    assert.equal(markedVersion(rom(1), [sibling(2), sibling(3)]), undefined)
  })
})

describe('the version RomM picks', () => {
  test('is asked for as a grouped grid asks, narrowed to this game', () => {
    assert.deepEqual(pickQuery(rom(1)), {
      group_by_meta_id: true,
      platform_ids: [3],
      search_term: 'Cave Story'
    })
  })

  test('and searched by file name where the game has no name', () => {
    assert.equal(pickQuery({ ...rom(1), name: null }).search_term, 'cavestory')
  })

  test('is the version of this game among the rows returned', () => {
    // The search can bring back other games sharing words with this one.
    const items = [{ id: 40 }, { id: 3 }, { id: 41 }]
    assert.equal(pickedVersion(items, rom(1), [sibling(2), sibling(3)]), 3)
  })

  test('and nothing where none of them came back', () => {
    assert.equal(pickedVersion([{ id: 40 }], rom(1), [sibling(2)]), null)
  })
})
