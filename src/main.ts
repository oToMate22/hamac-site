import './style.css'
import { createRoot } from 'react-dom/client'
import { createElement } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'

const homeMainHtml = document.querySelector('main')?.outerHTML ?? ''
const appRoot = document.createElement('div')
appRoot.id = 'app'
document.body.innerHTML = ''
document.body.appendChild(appRoot)

createRoot(appRoot).render(createElement(BrowserRouter, null, createElement(App, { homeMainHtml })))
