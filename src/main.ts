import './style.css'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import homeMainHtml from './static/home-main.html?raw'

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'
const { pathname, search, hash } = window.location
const underBasename =
  routerBasename === '/' ||
  pathname === routerBasename ||
  pathname.startsWith(`${routerBasename}/`)

if (!underBasename) {
  const nextPath = pathname === '/' || pathname === '/index.html' ? '/' : pathname
  window.location.replace(`${routerBasename}${nextPath}${search}${hash}`)
} else {
  const appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.innerHTML = ''
  document.body.appendChild(appRoot)

  createRoot(appRoot).render(
    createElement(BrowserRouter, { basename: routerBasename }, createElement(App, { homeMainHtml })),
  )
}
