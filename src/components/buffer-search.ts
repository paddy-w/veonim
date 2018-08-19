import { action, current as vim, jumpTo, getCurrent, feedkeys } from '../core/neovim'
import colorizer, { ColorData } from '../services/colorizer'
import { getCursorBoundingClientRect } from '../core/cursor'
import { RowNormal } from '../components/row-container'
import { currentWindowElement } from '../core/windows'
import { finder } from '../ai/update-server'
import Input from '../components/text-input'
import * as Icon from 'hyperapp-feather'
import { makel } from '../ui/vanilla'
import { app, h } from '../ui/uikit'
import { cvar } from '../ui/css'

interface FilterResult {
  line: string,
  start: {
    line: number,
    column: number,
  },
  end: {
    line: number,
    column: number,
  }
}

interface ColorizedFilterResult extends FilterResult {
  colorizedLine: ColorData[]
}

const cursor = (() => {
  let position = [0, 0]

  const save = async () => {
    const win = await getCurrent.window
    position = await win.cursor
  }

  const restore = async () => {
    const win = await getCurrent.window
    win.setCursor(position[0], position[1])
  }

  return { save, restore }
})()

let elPosTop = 0

const captureOverlayPosition = () => setImmediate(() => {
  // const { top } = element.getBoundingClientRect()
  const { top } = containerEl.getBoundingClientRect()
  elPosTop = top
})

const checkReadjustViewport = () => setTimeout(() => {
  // not the most performant
  // i tried using IntersectionObserver but it did not work i think because
  // both observed elements are absolutely positioned. all examples i've seen
  // are about detecting elements scrolling in/out of the viewport
  const { top } = getCursorBoundingClientRect()
  const hidden = top > elPosTop
  if (hidden) feedkeys('zz')
}, 10)

const state = {
  results: [] as ColorizedFilterResult[],
  visible: false,
  query: '',
  index: 0,
}

type S = typeof state

const resetState = { visible: false, query: '', results: [], index: 0 }

const jumpToResult = (state: S, index: number, { readjustViewport = false } = {}) => {
  const location = state.results[index]
  if (!location) return
  jumpTo(location.start)
  if (readjustViewport) checkReadjustViewport()
}

const actions = {
  hide: () => {
    cursor.restore()
    currentWindowElement.remove(containerEl)
    return resetState
  },
  show: () => {
    currentWindowElement.add(containerEl)
    cursor.save()
    captureOverlayPosition()
    return { visible: true }
  },
  select: () => (s: S) => {
    jumpToResult(s, s.index)
    currentWindowElement.remove(containerEl)
    return resetState
  },
  change: (query: string) => (_: S, a: A) => {
    finder.request.fuzzy(vim.cwd, vim.file, query).then(async (res: FilterResult[]) => {
      if (!res.length) return a.updateResults([])

      const textLines = res.map(m => m.line)
      const coloredLines: ColorData[][] = await colorizer.request.colorizePerChar(textLines, vim.filetype)

      const lines = coloredLines.filter(m => m.length).map((m, ix) => ({
        colorizedLine: m,
        ...res[ix],
      }))

      a.updateResults(lines)
    })
    return { query }
  },
  updateResults: (results: ColorizedFilterResult[]) => (s: S) => {
    jumpToResult(s, 0, { readjustViewport: true })
    return { results, index: 0 }
  },
  next: () => (s: S) => {
    if (!s.results.length) return

    const index = s.index + 1 > s.results.length - 1 ? 0 : s.index + 1
    jumpToResult(s, index, { readjustViewport: true })
    return { index }
  },
  prev: () => (s: S) => {
    if (!s.results.length) return

    const index = s.index - 1 < 0 ? s.results.length - 1 : s.index - 1
    jumpToResult(s, index, { readjustViewport: true })
    return { index }
  },
}

type A = typeof actions

const view = ($: S, a: A) => h('div', {
  style: {
    display: $.visible ? 'flex' : 'none',
    flexFlow: 'column',
    flex: 1,
  }
}, [

  ,Input({
    hide: a.hide,
    next: a.next,
    prev: a.prev,
    change: a.change,
    select: a.select,
    value: $.query,
    focus: true,
    small: true,
    icon: Icon.Search,
    desc: 'find in buffer',
  })

  ,h('div', {
    style: {
      overflow: 'hidden',
    }
  }, $.results.map((res, pos) => h(RowNormal, {
    active: pos === $.index,
  }, res.colorizedLine.map(({ color, text, highlight }) => h('span', {
    style: {
      whiteSpace: 'pre',
      color: color || cvar('foreground'),
      background: highlight && 'rgba(255, 255, 255, 0.1)',
    }
  }, text)))))
])


const containerEl = makel({
  position: 'absolute',
  display: 'flex',
  bottom: 0,
  zIndex: 90, // above cursor + cursorline,
  backdropFilter: 'blur(24px)',
  background: `rgba(var(--background-45-alpha), 0.7)`,
  maxHeight: '40%',
  height: '40%',
  width: '100%',
})

const ui = app({ name: 'buffer-search', state, actions, view, element: containerEl })

action('buffer-search', ui.show)
