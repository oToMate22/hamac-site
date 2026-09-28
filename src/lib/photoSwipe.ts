/**
 * Balayage des photos d'une carte de bien — au doigt, sur mobile uniquement.
 * Une seule implémentation pour tout le site : les cartes rendues par React
 * (PropertyCard) et celles injectées en HTML par l'accueil (HomePage).
 *
 * Les photos autres que la première ne sont montées qu'au moment du geste :
 * l'API renvoie 91 biens à 12 photos de médiane, tout charger est exclu.
 */

const REQUETE_MOBILE = '(max-width: 767px)'
const SEUIL = 8          // px de mouvement avant de considérer qu'on glisse
const FRANCHI = 0.18     // part de la largeur à franchir pour changer de photo
const SUPPRESSION = 16   // au-delà, c'est un vrai glissement : on annule le clic
const MAX_PASTILLES = 10

export function initPhotoSwipe(root: ParentNode = document): number {
  if (!window.matchMedia(REQUETE_MOBILE).matches) return 0
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

    // le rail : une bande large d'une photo, qu'on translate
    const rail = document.createElement('div')
    rail.className = 'bien-card__track'
    const existante = cadre.querySelector('img')
    if (existante) {
      existante.dataset.index = '0'
      rail.appendChild(existante)
    }
    cadre.appendChild(rail)
    const montees = new Set<number>(existante ? [0] : [])

    // les pastilles
    const pastilles = document.createElement('span')
    pastilles.className = 'bien-card__dots'
    pastilles.setAttribute('aria-hidden', 'true')
    cadre.appendChild(pastilles)

    let index = 0
    let depart: number | null = null
    let dx = 0
    let glisse = false
    let justeGlisse = false
    let minuteur: number | undefined

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
      // on insère à sa place, pour que le rail reste dans l'ordre des photos
      const suivant = Array.from(rail.children).find((el) => Number((el as HTMLElement).dataset.index) > i)
      rail.insertBefore(img, suivant ?? null)
    }

    const majPastilles = () => {
      pastilles.replaceChildren()
      fenetre(index).forEach((p) => {
        const point = document.createElement('i')
        point.className = 'bien-card__dot' + (p === index ? ' is-active' : '')
        pastilles.appendChild(point)
      })
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

    cadre.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return
      depart = e.clientX
      dx = 0
      glisse = false
    }, { passive: true })

    cadre.addEventListener('pointermove', (e) => {
      if (depart === null) return
      dx = e.clientX - depart
      if (!glisse && Math.abs(dx) > SEUIL) {
        glisse = true
        monter(index + 1)   // c'est ici, et seulement ici, que la photo suivante est demandée
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
      if (glisse && Math.abs(dx) > SUPPRESSION) {
        justeGlisse = true
        window.clearTimeout(minuteur)
        minuteur = window.setTimeout(() => { justeGlisse = false }, 400)
      }
      depart = null
    }
    cadre.addEventListener('pointerup', relacher)
    cadre.addEventListener('pointercancel', () => { depart = null; aller(index) })

    // un appui franc ouvre la fiche ; un glissement ne l'ouvre pas
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
