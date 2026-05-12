import './style.css'
import { mountSearchBars } from './search/mount'

mountSearchBars()

const yearEl = document.getElementById('year')
if (yearEl) {
  yearEl.textContent = String(new Date().getFullYear())
}

const header = document.querySelector<HTMLElement>('.site-header')
const onScroll = () => {
  if (!header) return
  header.classList.toggle('is-scrolled', window.scrollY > 24)
}
onScroll()
window.addEventListener('scroll', onScroll, { passive: true })

const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle')
const mobile = document.getElementById('nav-mobile')

if (toggle && mobile) {
  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open))
    if (open) {
      mobile.removeAttribute('hidden')
    } else {
      mobile.setAttribute('hidden', '')
    }
  }

  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true'
    setOpen(!open)
  })

  mobile.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false))
  })
}
