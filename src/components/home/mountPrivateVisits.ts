import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { PrivateVisitsCarousel } from '../PrivateVisitsCarousel'

let root: Root | null = null

export function mountPrivateVisits() {
  const node = document.querySelector<HTMLElement>('[data-private-visits-root]')
  if (!node) return

  if (!root) {
    root = createRoot(node)
  }

  root.render(createElement(PrivateVisitsCarousel))
}

export function unmountPrivateVisits() {
  root?.unmount()
  root = null
}
