const { join } = require('path')

const NotifyKind = {
  System: 'system',
  Success: 'success',
}

const configPath = '/Users/liz/.config'
const packPath = join(configPath, 'nvim/pack')

const setup = ({ getDirsPaths = [], existsPaths = [] } = {}) => {
  const mockExistPaths = new Set(existsPaths)
  const mockDirsPaths = getDirsPaths.slice()
  const mockNotifications = jest.fn()
  const mockNoop = () => {}
  const mockRemovePath = jest.fn()
  const mockNotifyKind = NotifyKind
  const mockNeovimCmd = jest.fn()
  const mockConfigPath = configPath

  jest.resetModules()

  jest.mock('fs-extra', () => ({
    remove: mockRemovePath,
  }))

  jest.mock('../../build/core/neovim', () => ({
    cmd: mockNeovimCmd,
  }))

  jest.mock('../../build/support/download', () => ({
    downloadRepo: () => Promise.resolve(true),
  }))

  jest.mock('../../build/support/utils', () => ({
    readFile: mockNoop,
    configPath: mockConfigPath,
    watchPathSymlink: mockNoop,
    is: { string: val => typeof val === 'string' },
    exists: path => Promise.resolve(mockExistPaths.has(path)),
    getDirs: () => Promise.resolve(mockDirsPaths)
  }))

  jest.mock('../../build/ui/notifications', () => ({
    notify: mockNotifications,
    NotifyKind: mockNotifyKind,
  }))

  const mp = require('../../build/support/manage-plugins')

  return {
    module: mp.default,
    removed: mockRemovePath,
    neovimCmd: mockNeovimCmd,
    notify: mockNotifications,
  }
}

const configLines = [
  `Plug 'tpope/vim-surround'`,
  `Plug 'wellle/targets.vim'`,
]

describe('manage plugins', () => {
  test('download & install success', async () => {
    const { module, notify, neovimCmd, removed } = setup()
    await module(configLines)

    // to contain number of processed plugins in the message
    expect(notify.mock.calls[0][0]).toContain(2)
    expect(notify.mock.calls[0][1]).toEqual(NotifyKind.System)
    expect(notify.mock.calls[1][0]).toContain(2)
    expect(notify.mock.calls[1][1]).toEqual(NotifyKind.Success)

    expect(removed).not.toHaveBeenCalled()
    expect(neovimCmd).toHaveBeenCalledWith('packloadall!')
  })

  test('no plugins found', async () => {
    const { module, notify, neovimCmd, removed } = setup()
    await module([])

    expect(notify).not.toHaveBeenCalled()
    expect(removed).not.toHaveBeenCalled()
    expect(neovimCmd).not.toHaveBeenCalled()
  })

  test('existing plugins', async () => {
    const { module, notify, neovimCmd, removed } = setup({
      existsPaths: [
        join(packPath, 'tpope-vim-surround'),
        join(packPath, 'wellle-targets.vim'),
      ]
    })

    await module(configLines)

    expect(notify).not.toHaveBeenCalled()
    expect(removed).not.toHaveBeenCalled()
    expect(neovimCmd).not.toHaveBeenCalled()
  })

  test('1 new + 1 to be removed', async () => {
    const { module, notify, neovimCmd, removed } = setup({
      getDirsPaths: [
        { name: 'tpope-vim-surround', path: join(packPath, 'tpope-vim-surround') },
      ]
    })

    await module(configLines.slice(1))

    expect(removed.mock.calls[0][0]).toEqual('/Users/liz/.config/nvim/pack/tpope-vim-surround')
    expect(notify.mock.calls[0][0]).toContain(1)
    expect(neovimCmd).toHaveBeenCalled()
  })

  test('bad config lines', async () => {
    const { module, notify, neovimCmd, removed } = setup()

    await module(['Plug lolumad?'])

    expect(notify).not.toHaveBeenCalled()
    expect(removed).not.toHaveBeenCalled()
    expect(neovimCmd).not.toHaveBeenCalled()
  })
})
