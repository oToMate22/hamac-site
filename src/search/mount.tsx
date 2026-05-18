import { createRoot, type Root } from 'react-dom/client'
import { SearchBar } from './SearchBar'

const searchBarRoots = new WeakMap<HTMLElement, Root>()

export const mountSearchBars = () => {
  const nodes = document.querySelectorAll<HTMLElement>('[data-searchbar-root]')
  nodes.forEach((node) => {
    const action = node.dataset.searchAction || '/acheter'
    const variant = node.dataset.searchVariant === 'hero-glass' ? 'hero-glass' : 'default'

    let root = searchBarRoots.get(node)
    if (!root) {
      root = createRoot(node)
      searchBarRoots.set(node, root)
    }

    root.render(<SearchBar action={action} variant={variant} />)
  })
}
