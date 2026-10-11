import { shared } from '../savepaths.ts'
import type { EmulatorDescriptor } from '../types.ts'

/**
 * Xemu — an original Xbox emulator.
 *
 *  - It covers **exactly one system**, which is what the per-system pin in
 *    `settings.systemEmulators` is for.
 *  - Its BIOS is **three files it has to be pointed at**: the MCPX boot ROM,
 *    the flash ROM and a hard disk image, each a path in `xemu.toml` with no
 *    default. RomMix places them in Xemu's own folder and does not write into
 *    Xemu's configuration, so selecting them is left to the user — see
 *    `setupNotes`.
 *  - Its saves live **inside that hard disk image**, one for every game, so
 *    there is no per-game save for RomMix to sync.
 *
 * On Flathub as `app.xemu.xemu` and published as an AppImage besides, so RomMix
 * offers both. Outside portable mode it keeps everything in SDL's preference
 * path for `xemu`/`xemu` — see `xemu_settings_get_base_path` in its
 * `ui/xemu-settings.cc` — which is `xemu/xemu` under the data root.
 */
export const xemu: EmulatorDescriptor = {
  id: 'xemu',
  name: 'Xemu',
  dispatch: 'rommix',
  install: [
    { kind: 'flatpak', appId: 'app.xemu.xemu' },
    { kind: 'binary', names: ['xemu'] },
    {
      kind: 'appimage',
      patterns: ['xemu*.appimage'],
      release: {
        api: 'https://api.github.com/repos/xemu-project/xemu/releases',
        // `xemu-<version>-<arch>.AppImage`. A `-dbg-` build with debug symbols
        // is published beside every one, and is not what anybody means to run.
        asset: /^xemu-(?!.*-dbg-).*\.AppImage$/i
      }
    }
  ],
  homepage: 'https://xemu.app',
  systems: ['xbox'],
  // One Xbox emulator, one way to run a game.
  variants: undefined,
  ownsLibrary: false,
  dirs: {
    // Xemu has no ROM folder and no game list: a disc is opened by path.
    // RomMix's own folder is therefore the honest answer.
    roms: { base: 'rommix', path: 'roms' },
    // The hard disk image holds every save. Named so the Pull and Push buttons
    // can say why they moved nothing, rather than that nothing was found.
    saves: { base: 'data', path: 'xemu/xemu' },
    bios: { base: 'data', path: 'xemu/xemu' }
    // No `states`: Xemu's snapshots are written into the hard disk image too.
  },
  // Fixed by SDL's preference path, with nothing user-selectable.
  layout: undefined,
  // A game is one disc image.
  flatLibrary: false,
  // Xemu is handed each game by path and scans no folder.
  needsRomFolders: false,
  saves: (ctx) => ({
    saves: ctx.paths.saves ? shared(ctx.paths.saves) : null,
    states: null,
    unsyncableReason: 'saves.xemu'
  }),
  bios: undefined,
  biosStagingNote: undefined,
  // Xemu is one emulator, not a core loader.
  core: undefined,
  /**
   * Xemu starts a game only once its boot ROM, flash ROM and hard disk image
   * are selected, and RomMix does not write into another program's
   * configuration.
   */
  setupNotes: ['setup.xemuFiles'],
  env: undefined,
  // `exec` alone opens Xemu at its dashboard, or at its settings without files.
  open: undefined,
  // The same switches ES-DE and EmuDeck give it.
  launch: ({ exec, romPath }) => [...exec, '-full-screen', '-dvd_path', romPath]
}
