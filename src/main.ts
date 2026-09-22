import './style.css'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import homeMainHtml from './static/home-main.html?raw'

const appRoot = document.createElement('div')
appRoot.id = 'app'
document.body.innerHTML = ''
document.body.appendChild(appRoot)

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(appRoot).render(
  createElement(BrowserRouter, { basename: routerBasename }, createElement(App, { homeMainHtml })),
)
