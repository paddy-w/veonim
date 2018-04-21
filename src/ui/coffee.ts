let reactModule = 'react/umd/react.production.min'
let reactDomModule = 'react-dom/umd/react-dom.production.min.js'

if (process.env.VEONIM_DEV) reactModule = 'react'
if (process.env.VEONIM_DEV) reactDomModule = 'react-dom'

const React = require(reactModule)
const ReactDom = require(reactDomModule)

import hyperscript from '../ui/hyperscript'
import sct from 'styled-components-ts'
import sc from 'styled-components'

// TODO: this file should be deprecated in favor of uikit2
export const s = sct
export const styled = sc
export const h = hyperscript(React.createElement)
export const createElement = React.createElement
export const renderDom = (vNode: any, element: HTMLElement) => ReactDom.render(vNode, element)
