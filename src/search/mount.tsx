import { createRoot } from 'react-dom/client'
import { SearchBar } from './SearchBar'

export const mountSearchBars = () => {
  const roots = document.querySelectorAll<HTMLElement>('[data-searchbar-root]')
  roots.forEach((node) => {
    const action = node.dataset.searchAction || '/acheter'
    const variant = node.dataset.searchVariant === 'hero-glass' ? 'hero-glass' : 'default'
    createRoot(node).render(<SearchBar action={action} variant={variant} />)
  })
}
