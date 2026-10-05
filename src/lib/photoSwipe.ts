/**
 * Balayage des photos d'une carte de bien.
 * Mobile : glisser au doigt. Desktop : pastilles, flèches au survol, deux doigts sur le pad.
 * Une seule implémentation pour React (PropertyCard) et l'accueil (HomePage).
 *
 * Les photos autres que la première ne sont montées qu'au moment du geste :
 * l'API renvoie 91 biens à 12 photos de médiane, tout charger est exclu.
 */

const SEUIL = 8          // px de mouvement avant de considérer qu'on glisse
const FRANCHI = 0.18     // part de la largeur à franchir pour changer de photo
const SUPPRESSION = 16   // au-delà, c'est un vrai glissement : on annule le clic
const MAX_PASTILLES = 10
const ROUE_SEUIL = 40
const ROUE_VERROU_MS = 550

/** Trackpad / molette horizontale : une photo par geste, pas deux. */
export function bindHorizontalPhotoWheel(
  element: HTMLElement,
  onStep: (direction: 1 | -1) => void,
): () => void {
  let acc = 0
  let locked = false
  let unlockTimer: number | undefined

  const onWheel = (event: WheelEvent) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
    event.preventDefault()
    event.stopPropagation()
    if (locked) return
    acc += event.deltaX
    if (Math.abs(acc) < ROUE_SEUIL) return
    onStep(acc > 0 ? 1 : -1)
    acc = 0
    locked = true
    window.clearTimeout(unlockTimer)
    unlockTimer = window.setTimeout(() => {
      locked = false
      acc = 0
    }, ROUE_VERROU_MS)
  }

  element.addEventListener('wheel', onWheel, { passive: false })
  return () => {
    element.removeEventListener('wheel', onWheel)
    window.clearTimeout(unlockTimer)
  }
}

export function initPhotoSwipe(root: ParentNode = document): number {
  let initialisees = 0

  root.querySelectorAll<HTMLElement>('.bien-card__img[data-photos]').forEach((cadre) => {
    if (cadre.dataset.swipeReady) return
    let photos: string[]
    try {
      photos = JSON.parse(decodeURIComponent(cadre.dataset.photos ?? ''))
    } catch {
      return
    }
    if (!Array.isArray(photos) || photos.length < 2) return

    const carte = (cadre.closest('.bien-card') as HTMLElement) ?? cadre
    const titre = carte.querySelector('.bien-card__title')?.textContent?.trim() ?? ''

    const rail = document.createElement('div')
    rail.className = 'bien-card__track'
    const existante = cadre.querySelector('img')
    if (existante) {
      existante.dataset.index = '0'
      existante.draggable = false
      rail.appendChild(existante)
    }
    cadre.appendChild(rail)
    const montees = new Set<number>(existante ? [0] : [])

    const pastilles = document.createElement('span')
    pastilles.className = 'bien-card__dots'
    pastilles.setAttribute('role', 'group')
    pastilles.setAttribute('aria-label', 'Photos du bien')
    cadre.appendChild(pastilles)

    const prev = document.createElement('button')
    prev.type = 'button'
    prev.className = 'bien-card__nav bien-card__nav--prev'
    prev.setAttribute('aria-label', 'Photo précédente')
    prev.textContent = '‹'

    const next = document.createElement('button')
    next.type = 'button'
    next.className = 'bien-card__nav bien-card__nav--next'
    next.setAttribute('aria-label', 'Photo suivante')
    next.textContent = '›'

    cadre.appendChild(prev)
    cadre.appendChild(next)

    let index = 0
    let depart: number | null = null
    let dx = 0
    let glisse = false
    let justeGlisse = false
    let minuteur: number | undefined
    let roue = 0
    let roueVerrou = false

    const fenetre = (i: number): number[] => {
      const max = Math.min(photos.length, MAX_PASTILLES)
      const centre = Math.floor(max / 2)
      const debut = Math.max(0, Math.min(i - centre, photos.length - max))
      return Array.from({ length: max }, (_, k) => debut + k)
    }

    const monter = (i: number) => {
      if (i < 0 || i >= photos.length || montees.has(i)) return
      montees.add(i)
      const img = document.createElement('img')
      img.dataset.index = String(i)
      img.src = photos[i]
      img.alt = `Photo ${i + 1} sur ${photos.length}${titre ? ' — ' + titre : ''}`
      img.loading = 'lazy'
      img.decoding = 'async'
      img.draggable = false
      const suivant = Array.from(rail.children).find((el) => Number((el as HTMLElement).dataset.index) > i)
      rail.insertBefore(img, suivant ?? null)
    }

    const majPastilles = () => {
      pastilles.replaceChildren()
      fenetre(index).forEach((p) => {
        const point = document.createElement('button')
        point.type = 'button'
        point.className = 'bien-card__dot' + (p === index ? ' is-active' : '')
        point.dataset.photo = String(p)
        point.setAttribute('aria-label', `Photo ${p + 1} sur ${photos.length}`)
        point.setAttribute('aria-current', p === index ? 'true' : 'false')
        pastilles.appendChild(point)
      })
      prev.hidden = index <= 0
      next.hidden = index >= photos.length - 1
    }

    const aller = (i: number) => {
      const cible = Math.max(0, Math.min(photos.length - 1, i))
      monter(cible)
      monter(cible + 1)
      monter(cible - 1)
      index = cible
      rail.style.transition = 'transform .32s cubic-bezier(.22,.61,.36,1)'
      rail.style.transform = `translate3d(${-cible * 100}%, 0, 0)`
      cadre.dataset.index = String(cible)
      majPastilles()
    }

    const bloquerClicCarte = () => {
      justeGlisse = true
      window.clearTimeout(minuteur)
      minuteur = window.setTimeout(() => { justeGlisse = false }, 400)
    }

    cadre.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return
      if ((e.target as HTMLElement).closest('.bien-card__nav, .bien-card__dots')) return
      depart = e.clientX
      dx = 0
      glisse = false
    }, { passive: true })

    cadre.addEventListener('pointermove', (e) => {
      if (depart === null) return
      dx = e.clientX - depart
      if (!glisse && Math.abs(dx) > SEUIL) {
        glisse = true
        monter(index + 1)
        monter(index - 1)
      }
      if (!glisse) return
      rail.style.transition = 'none'
      rail.style.transform = `translate3d(calc(${-index * 100}% + ${dx}px), 0, 0)`
    }, { passive: true })

    const relacher = () => {
      if (depart === null) return
      const seuil = cadre.clientWidth * FRANCHI
      if (glisse && Math.abs(dx) > seuil) aller(index + (dx < 0 ? 1 : -1))
      else aller(index)
      if (glisse && Math.abs(dx) > SUPPRESSION) bloquerClicCarte()
      depart = null
    }
    cadre.addEventListener('pointerup', relacher)
    cadre.addEventListener('pointercancel', () => { depart = null; aller(index) })

    cadre.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      if (roueVerrou) return
      roue += e.deltaX
      if (Math.abs(roue) < ROUE_SEUIL) return
      aller(index + (roue > 0 ? 1 : -1))
      roue = 0
      roueVerrou = true
      window.setTimeout(() => {
        roueVerrou = false
        roue = 0
      }, ROUE_VERROU_MS)
    }, { passive: false })

    pastilles.addEventListener('click', (e) => {
      const point = (e.target as HTMLElement).closest<HTMLElement>('[data-photo]')
      if (!point) return
      e.preventDefault()
      e.stopPropagation()
      const cible = Number(point.dataset.photo)
      if (!Number.isFinite(cible) || cible === index) return
      aller(cible)
    }, true)

    prev.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      aller(index - 1)
    })
    next.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      aller(index + 1)
    })

    carte.addEventListener('click', (e) => {
      if (!justeGlisse) return
      e.preventDefault()
      e.stopPropagation()
    }, true)

    majPastilles()
    cadre.dataset.swipeReady = '1'
    initialisees++
  })

  return initialisees
}
