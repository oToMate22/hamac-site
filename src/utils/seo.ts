import { useEffect } from 'react'

type PageMeta = {
  title: string
  description: string
  ogType?: string
}

const upsertMetaByName = (name: string, content: string) => {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('name', name)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

const upsertMetaByProperty = (property: string, content: string) => {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (!node) {
    node = document.createElement('meta')
    node.setAttribute('property', property)
    document.head.appendChild(node)
  }
  node.setAttribute('content', content)
}

export const applyPageMeta = ({ title, description, ogType = 'website' }: PageMeta) => {
  document.title = title
  upsertMetaByName('description', description)
  upsertMetaByProperty('og:title', title)
  upsertMetaByProperty('og:description', description)
  upsertMetaByProperty('og:type', ogType)
}

export const usePageMeta = (meta: PageMeta) => {
  useEffect(() => {
    applyPageMeta(meta)
  }, [meta.description, meta.ogType, meta.title])
}
