import { useEffect, useMemo } from 'react'
import { animate, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'
import { CLIENT_REVIEWS } from '../data/clientReviews'
import { BLOG_POSTS } from '../data/blogPosts'
import { mountPrivateVisits, unmountPrivateVisits } from '../components/home/mountPrivateVisits'
import { mountSearchBars } from '../search/mount'
import { initPhotoSwipe } from '../lib/photoSwipe'
import { getProperties, type FeaturedProperty } from '../services/apimo'
import { imageApimo, srcsetApimo } from '../utils/images'
import { realEstateAgentJsonLd } from '../seo/jsonld'
import { usePageMeta } from '../utils/seo'

type HomePageProps = {
  homeMainHtml: string
}

export function HomePage({ homeMainHtml }: HomePageProps) {
  usePageMeta({
    title: 'Hamac — Immobilier premium | Ouest Lyonnais',
    description:
      "Hamac Investissements & Patrimoine — agence immobilière premium dans l'Ouest Lyonnais. Immobilier de confiance, sur-mesure et humain.",
    jsonLd: [{ id: 'ld-agent', data: realEstateAgentJsonLd() }],
  })
  const { scrollY } = useScroll()
  const heroParallaxY = useTransform(scrollY, (value) => value * 0.3)

  useMotionValueEvent(heroParallaxY, 'change', (latest) => {
    const heroCarousel = document.querySelector<HTMLElement>('.hero__carousel')
    if (!heroCarousel) return
    heroCarousel.style.transform = `translate3d(0, ${latest}px, 0)`
  })

  const latestPosts = useMemo(
    () =>
      [...BLOG_POSTS]
        .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
        .slice(0, 3),
    [],
  )

  const latestPostsHtml = useMemo(() => {
    const formatDate = (value: string) =>
      new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))

    const cards = latestPosts
      .map(
        (post) => `
          <article class="blog-card home-journal__card">
            <a class="blog-card__link" href="/blog/${post.slug}">
              <div class="blog-card__image-wrap">
                <img src="${post.coverImage}" alt="Photo de couverture: ${post.title}" loading="lazy" />
              </div>
              <div class="blog-card__body">
                <span class="blog-card__badge">${post.category}</span>
                <h3>${post.title}</h3>
                <p>${post.excerpt}</p>
                <small>${post.author} · ${formatDate(post.publishedDate)} · ${post.readTime}</small>
              </div>
            </a>
          </article>
        `,
      )
      .join('')

    return `
      <div class="container">
        <header class="section-header">
          <p class="eyebrow">JOURNAL</p>
          <h2 class="section-title">Derniers articles</h2>
          <p class="section-subtitle">Analyses du marché, guides pratiques et vie locale dans l'Ouest Lyonnais.</p>
        </header>
        <div class="home-journal__grid">
          ${cards}
        </div>
        <p class="home-journal__actions">
          <a class="home-journal__link" href="/blog">Lire tous nos articles <span aria-hidden="true">→</span></a>
        </p>
      </div>
    `
  }, [latestPosts])

  const html = useMemo(
    () =>
      homeMainHtml
        .replaceAll('/fr/biens?', '/fr/acheter?')
        .replaceAll('/fr/biens/', '/fr/acheter/')
        .replaceAll('href="/fr/biens"', 'href="/fr/acheter"')
        .replaceAll('/biens?', '/acheter?')
        .replaceAll('/biens/', '/acheter/')
        .replaceAll('href="/biens"', 'href="/acheter"')
        .replace('<section class="section section--cream home-journal" data-home-journal></section>', `<section class="section section--cream home-journal">${latestPostsHtml}</section>`),
    [homeMainHtml, latestPostsHtml],
  )

  useEffect(() => {
    mountSearchBars()
    mountPrivateVisits()
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const slides = document.querySelectorAll<HTMLElement>('.hero-slide')
    const slideBackgrounds = Array.from(document.querySelectorAll<HTMLElement>('.hero-slide__ken'))
    const heroEyebrow = document.querySelector<HTMLElement>('.hero__eyebrow')
    const heroEyebrowBySlide = [
      'Agence locale & conseil',
      'Investissements & patrimoine',
      'Acheter - vendre - estimer',
      'Architecture & confort',
    ]

    // Preload the visible hero immediately; the other slides wait 2s so the first paint stays light.
    const preloadBackground = (slide: HTMLElement) => {
      const bg = slide.style.backgroundImage
      const url = bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
      if (!url) return
      const image = new Image()
      image.decoding = 'async'
      image.src = url
    }
    slideBackgrounds.forEach((slide, index) => {
      if (index === 0) preloadBackground(slide)
      else window.setTimeout(() => preloadBackground(slide), 2000)
    })

    let interval: number | undefined
    let slideIndex = 0

    if (slides.length > 1) {
      const labelForSlide = (i: number) =>
        heroEyebrowBySlide[i % heroEyebrowBySlide.length] ?? heroEyebrowBySlide[0]

      if (prefersReducedMotion && heroEyebrow) {
        heroEyebrow.replaceChildren(document.createTextNode(labelForSlide(0)))
        heroEyebrow.setAttribute('aria-label', labelForSlide(0))
      }

      if (!prefersReducedMotion && heroEyebrow) {
        if (!heroEyebrow.querySelector('.hero__eyebrow-layer')) {
          const initial = heroEyebrow.textContent?.trim() || labelForSlide(0)
          heroEyebrow.textContent = ''
          const a = document.createElement('span')
          const b = document.createElement('span')
          a.className = 'hero__eyebrow-layer is-visible'
          b.className = 'hero__eyebrow-layer'
          a.setAttribute('aria-hidden', 'true')
          b.setAttribute('aria-hidden', 'true')
          a.textContent = initial
          b.textContent = ''
          heroEyebrow.appendChild(a)
          heroEyebrow.appendChild(b)
        }
        heroEyebrow.setAttribute('aria-label', labelForSlide(0))
      }

      let eyebrowVisibleLayer = 0
      if (heroEyebrow && !prefersReducedMotion) {
        const layerNodes = heroEyebrow.querySelectorAll<HTMLElement>('.hero__eyebrow-layer')
        if (layerNodes[1]?.classList.contains('is-visible')) eyebrowVisibleLayer = 1
      }

      const syncEyebrowToSlide = (i: number) => {
        if (!heroEyebrow) return
        const label = labelForSlide(i)
        heroEyebrow.setAttribute('aria-label', label)
        if (prefersReducedMotion) {
          heroEyebrow.replaceChildren(document.createTextNode(label))
          return
        }
        const layerNodes = heroEyebrow.querySelectorAll<HTMLElement>('.hero__eyebrow-layer')
        if (layerNodes.length < 2) {
          heroEyebrow.textContent = label
          return
        }
        const nextLayer = 1 - eyebrowVisibleLayer
        layerNodes[nextLayer].textContent = label
        layerNodes[eyebrowVisibleLayer].classList.remove('is-visible')
        layerNodes[nextLayer].classList.add('is-visible')
        eyebrowVisibleLayer = nextLayer
      }

      interval = window.setInterval(() => {
        slideIndex = (slideIndex + 1) % slides.length
        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === slideIndex))
        syncEyebrowToSlide(slideIndex)
      }, 6000)
    }

    let handlers: Array<{ chip: HTMLButtonElement; onClick: () => void }> = []
    let cancelled = false
    const observers: IntersectionObserver[] = []

    const setupReveal = (
      selector: string,
      getDelay?: (index: number) => number,
      options?: { fromY?: number; fromScale?: number },
    ) => {
      if (prefersReducedMotion) return
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
      if (!elements.length) return
      const fromY = options?.fromY ?? 80
      const fromScale = options?.fromScale ?? 0.95

      elements.forEach((element) => {
        element.style.opacity = '0'
        element.style.transform = `translateY(${fromY}px) scale(${fromScale})`
      })

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const el = entry.target as HTMLElement
            const index = elements.indexOf(el)
            const delay = getDelay ? getDelay(index) : 0

            animate(
              el,
              {
                opacity: [0, 1],
                transform: [`translateY(${fromY}px) scale(${fromScale})`, 'translateY(0px) scale(1)'],
              },
              { duration: 0.5, ease: 'easeOut', delay },
            )
            observer.unobserve(el)
          })
        },
        { threshold: 0.2 },
      )

      elements.forEach((element) => observer.observe(element))
      observers.push(observer)
    }

    const setupHeroIntroAnimation = () => {
      if (prefersReducedMotion) return
      const heroTypeCharMs = 88
      const heroTypeStartMs = 480

      const eyebrow = document.querySelector<HTMLElement>('.hero__eyebrow')
      const title = document.querySelector<HTMLElement>('.hero__title')
      const lead = document.querySelector<HTMLElement>('.hero__lead')
      const cta = document.querySelector<HTMLElement>('.hero__secondary')

      if (eyebrow) {
        eyebrow.style.opacity = '0'
        eyebrow.style.transform = 'translate3d(2.75rem, 0, 0)'
        animate(
          eyebrow,
          { opacity: [0, 1], transform: ['translate3d(2.75rem, 0, 0)', 'translate3d(0, 0, 0)'] },
          { duration: 0.85, ease: [0.22, 1, 0.36, 1] },
        )
      }

      if (lead) {
        lead.style.opacity = '0'
        lead.style.transform = 'translate3d(-2.75rem, 0, 0)'
        animate(
          lead,
          { opacity: [0, 1], transform: ['translate3d(-2.75rem, 0, 0)', 'translate3d(0, 0, 0)'] },
          { duration: 0.85, delay: 0.22, ease: [0.22, 1, 0.36, 1] },
        )
      }

      if (title) {
        const fullText = title.textContent?.trim() ?? ''
        title.dataset.typewriterFull = fullText
        title.setAttribute('aria-label', fullText)
        title.textContent = ''
        title.style.opacity = '1'
        title.style.transform = 'none'
        title.classList.add('hero__title--typewriter')

        const measure = document.createElement('span')
        measure.className = 'hero__title__measure'
        measure.setAttribute('aria-hidden', 'true')
        measure.textContent = fullText

        const typed = document.createElement('span')
        typed.className = 'hero__title__typed hero__title--typing'

        title.appendChild(measure)
        title.appendChild(typed)

        const flattenTitle = () => {
          title.textContent = fullText
          title.classList.remove('hero__title--typewriter')
          title.removeAttribute('aria-label')
          delete title.dataset.typewriterFull
        }

        const charMs = heroTypeCharMs
        const startDelayMs = heroTypeStartMs
        let i = 0

        const step = () => {
          if (cancelled) {
            flattenTitle()
            return
          }
          if (i < fullText.length) {
            i += 1
            typed.textContent = fullText.slice(0, i)
            window.setTimeout(step, charMs)
          } else {
            typed.classList.remove('hero__title--typing')
            flattenTitle()
          }
        }
        window.setTimeout(step, startDelayMs)
      }

      if (cta) {
        const fullTitle =
          document.querySelector<HTMLElement>('.hero__title')?.dataset.typewriterFull?.trim() ?? ''
        const typingMs =
          fullTitle.length > 0
            ? heroTypeStartMs + fullTitle.length * heroTypeCharMs + 550
            : 2200

        cta.style.opacity = '0'
        cta.style.transform = 'scale(0.96)'
        animate(
          cta,
          { opacity: [0, 1], transform: ['scale(0.96)', 'scale(1)'] },
          { duration: 0.55, delay: typingMs / 1000, ease: 'easeOut' },
        )
      }
    }

    setupHeroIntroAnimation()

    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')

    const computeStarParts = (score: number): { full: number; half: boolean } => {
      if (score >= 5) return { full: 5, half: false }
      if (score >= 4.5 && score < 5) return { full: 4, half: true }
      const roundedHalf = Math.round(score * 2) / 2
      const full = Math.min(5, Math.floor(roundedHalf))
      const half = roundedHalf % 1 !== 0 && full < 5
      return { full, half }
    }

    const appendRatingStars = (container: HTMLElement, fullStars: number, halfStar: boolean) => {
      const stars = document.createElement('span')
      stars.className = 'temoignage-card__rating-stars'
      stars.setAttribute('aria-hidden', 'true')

      let placed = 0
      for (; placed < fullStars; placed += 1) {
        const star = document.createElement('span')
        star.className = 'temoignage-card__star temoignage-card__star--full'
        star.textContent = '★'
        stars.appendChild(star)
      }
      if (halfStar) {
        const wrap = document.createElement('span')
        wrap.className = 'temoignage-card__star temoignage-card__star--half'
        const track = document.createElement('span')
        track.className = 'temoignage-card__star-half__track'
        track.textContent = '★'
        const fill = document.createElement('span')
        fill.className = 'temoignage-card__star-half__fill'
        fill.textContent = '★'
        wrap.appendChild(track)
        wrap.appendChild(fill)
        stars.appendChild(wrap)
        placed += 1
      }
      for (; placed < 5; placed += 1) {
        const star = document.createElement('span')
        star.className = 'temoignage-card__star temoignage-card__star--empty'
        star.textContent = '★'
        stars.appendChild(star)
      }

      container.appendChild(stars)
    }

    const formatReviewScoreLabel = (score: number) => {
      if (score >= 5) return '5'
      const rounded = Math.round(score * 10) / 10
      if (Number.isInteger(rounded)) return String(rounded)
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(rounded)
    }

    const setupTemoignageRatings = () => {
      document.querySelectorAll<HTMLElement>('[data-temoignage-rating]').forEach((el) => {
        const fixed = el.dataset.temoignageScore
        const raw = fixed !== undefined ? Number.parseFloat(fixed) : 4.6 + Math.random() * 0.39999
        const score = Math.min(5, Math.round(raw * 10) / 10)
        const label = formatReviewScoreLabel(score)
        const { full, half } = computeStarParts(score)

        el.replaceChildren()
        el.classList.add('temoignage-card__rating--with-stars')

        const scoreEl = document.createElement('span')
        scoreEl.className = 'temoignage-card__rating-score'
        scoreEl.textContent = `${label}/5`
        el.appendChild(scoreEl)
        appendRatingStars(el, full, half)

        const starLabel =
          half && full === 4
            ? `Note ${label} sur 5, quatre étoiles et demi sur cinq`
            : `Note ${label} sur 5, ${full} étoile${full > 1 ? 's' : ''} sur cinq`
        el.setAttribute('aria-label', starLabel)
      })
    }

    const setupClientReviewCards = () => {
      const track = document.querySelector<HTMLElement>('[data-temoignages-track]')
      if (!track || !CLIENT_REVIEWS.length) return

      track.innerHTML = CLIENT_REVIEWS.map(
        (review) => `
          <figure class="temoignage-card">
            <p class="temoignage-card__rating" data-temoignage-rating${
              review.rating !== undefined ? ` data-temoignage-score="${review.rating}"` : ''
            }></p>
            <blockquote class="temoignage-card__quote">
              <p>${escapeHtml(review.quote)}</p>
            </blockquote>
            <figcaption class="temoignage-card__author">${escapeHtml(review.author)}</figcaption>
          </figure>
        `,
      ).join('')

      track.classList.toggle('temoignages-grid--few', CLIENT_REVIEWS.length <= 3)
    }

    setupClientReviewCards()
    setupTemoignageRatings()
    setupReveal('.temoignage-card', (index) => Math.min(index * 0.12, 0.35))

    const setupTemoignagesCarousel = () => {
      const track = document.querySelector<HTMLElement>('[data-temoignages-track]')
      const nextBtn = document.querySelector<HTMLButtonElement>('[data-temoignages-next]')
      if (!track || !nextBtn) return

      const cards = () => Array.from(track.querySelectorAll<HTMLElement>('.temoignage-card'))

      const updateNextState = () => {
        const maxScroll = track.scrollWidth - track.clientWidth
        nextBtn.disabled = maxScroll <= 4
      }

      const scrollNext = () => {
        const items = cards()
        if (!items.length) return

        const gap = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 20
        const step = items[0].offsetWidth + gap
        const maxScroll = track.scrollWidth - track.clientWidth
        const target = track.scrollLeft + step
        const behavior = prefersReducedMotion ? ('auto' as const) : ('smooth' as const)

        if (target >= maxScroll - 4) {
          track.scrollTo({ left: 0, behavior })
        } else {
          track.scrollTo({ left: target, behavior })
        }
      }

      const onNext = () => scrollNext()
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          scrollNext()
        }
      }
      const onResize = () => updateNextState()

      nextBtn.addEventListener('click', onNext)
      track.addEventListener('keydown', onKeyDown)
      window.addEventListener('resize', onResize)
      updateNextState()

      return () => {
        nextBtn.removeEventListener('click', onNext)
        track.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('resize', onResize)
      }
    }

    const teardownTemoignagesCarousel = setupTemoignagesCarousel()

    const setupSectionTitleUnderline = () => {
      if (prefersReducedMotion) return
      const titles = Array.from(document.querySelectorAll<HTMLElement>('.section-title'))
      if (!titles.length) return

      titles.forEach((title) => {
        if (title.querySelector('.section-title__underline')) return
        const underline = document.createElement('span')
        underline.className = 'section-title__underline'
        title.appendChild(underline)
      })

      const underlines = Array.from(document.querySelectorAll<HTMLElement>('.section-title__underline'))
      underlines.forEach((underline) => {
        underline.style.transform = 'scaleX(0)'
        underline.style.transformOrigin = 'left'
      })

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const el = entry.target as HTMLElement
            animate(el, { transform: ['scaleX(0)', 'scaleX(1)'] }, { duration: 0.6, ease: 'easeOut' })
            observer.unobserve(el)
          })
        },
        { threshold: 0.3 },
      )

      underlines.forEach((underline) => observer.observe(underline))
      observers.push(observer)
    }

    const setupSectionTitleTextReveal = () => {
      if (prefersReducedMotion) return
      const titles = Array.from(document.querySelectorAll<HTMLElement>('.section-title'))
      if (!titles.length) return

      titles.forEach((title) => {
        if (title.dataset.revealPrepared === 'true') return
        const text = title.textContent?.trim() ?? ''
        if (!text) return

        title.dataset.revealPrepared = 'true'
        title.classList.add('section-title--reveal')
        title.textContent = ''

        const words = text.split(/\s+/)
        words.forEach((word, idx) => {
          const mask = document.createElement('span')
          mask.className = 'section-title__word-mask'
          const wordSpan = document.createElement('span')
          wordSpan.className = 'section-title__word'
          wordSpan.textContent = `${word}${idx < words.length - 1 ? '\u00A0' : ''}`
          mask.appendChild(wordSpan)
          title.appendChild(mask)
        })
      })

      const titleObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const title = entry.target as HTMLElement
            const words = Array.from(title.querySelectorAll<HTMLElement>('.section-title__word'))
            if (!words.length) {
              titleObserver.unobserve(title)
              return
            }

            words.forEach((word, index) => {
              word.style.opacity = '0'
              word.style.transform = 'translateY(60px)'
              animate(
                word,
                { opacity: [0, 1], transform: ['translateY(60px)', 'translateY(0px)'] },
                { duration: 0.8, ease: 'easeOut', delay: Math.min(index * 0.06, 0.3) },
              )
            })

            title.classList.add('is-revealed')
            titleObserver.unobserve(title)
          })
        },
        { threshold: 0.5 },
      )

      titles.forEach((title) => titleObserver.observe(title))
      observers.push(titleObserver)
    }

    const setupStatsCountAnimation = () => {
      if (prefersReducedMotion) return
      const stats = Array.from(document.querySelectorAll<HTMLElement>('.key-stats-banner__value'))
      if (!stats.length) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            const el = entry.target as HTMLElement
            const raw = el.dataset.originalValue ?? el.textContent?.trim() ?? ''
            el.dataset.originalValue = raw

            const match = raw.match(/-?\d+(?:[.,]\d+)?/)
            if (!match || match.index === undefined) {
              observer.unobserve(el)
              return
            }

            const prefix = raw.slice(0, match.index)
            const numeric = match[0]
            const suffix = raw.slice(match.index + numeric.length)
            const isDecimal = /[.,]/.test(numeric)
            const target = Number(numeric.replace(',', '.'))

            animate(0, target, {
              duration: 1,
              ease: 'easeOut',
              onUpdate: (latest) => {
                const value = isDecimal ? latest.toFixed(1).replace('.', ',') : String(Math.round(latest))
                el.textContent = `${prefix}${value}${suffix}`
              },
            })

            observer.unobserve(el)
          })
        },
        { threshold: 0.35 },
      )

      stats.forEach((stat) => observer.observe(stat))
      observers.push(observer)
    }

    const initFeatured = async () => {
      const grid = document.querySelector<HTMLElement>('.biens-grid')
      const showStatus = (message: string) => {
        if (!grid) return
        grid.innerHTML = `<p class="biens-grid__status">${message}</p>`
      }

      try {
        const featured = await getProperties()
        if (cancelled) return

        if (grid && featured.length) {
          const items = featured.slice(0, 6)
          const toCard = (p: FeaturedProperty, i: number) => {
            const jardin = p.amenities.includes('jardin') ? 'true' : 'false'
            const piscine = p.amenities.includes('piscine') ? 'true' : 'false'
            const exclusive = p.badge === 'Exclusivite' ? 'true' : 'false'
            const kind = p.type
            const price = `${new Intl.NumberFormat('fr-FR').format(p.price)} €`
            const bedrooms = p.bedrooms
            const loading = i === 0 ? 'eager' : 'lazy'
            const brut = p.images[0] ?? '/fr/images/Biens/maison-homepage.webp'
            const img = imageApimo(brut, 800)
            const jeu = srcsetApimo(brut, [400, 800, 1200])
            const alt = `Photo du bien ${p.title} à ${p.city}`
            const photos = p.images.length > 1
              ? ` data-photos="${encodeURIComponent(JSON.stringify(p.images))}"`
              : ''

            return `
              <article class="bien-card" data-bien-card data-kind="${kind}" data-jardin="${jardin}" data-piscine="${piscine}" data-exclusive="${exclusive}">
                <a href="/acheter/${p.slug}" class="bien-card__link">
                  <div class="bien-card__img"${photos}>
                    <img src="${img}"${jeu ? ` srcset="${jeu}" sizes="(max-width: 1023px) 92vw, 47vw"` : ''} alt="${alt}" width="800" height="560" loading="${loading}" />
                  </div>
                  <div class="bien-card__body">
                    <p class="bien-card__price">${price}</p>
                    <h3 class="bien-card__title">${p.title} — ${p.city}</h3>
                    <p class="bien-card__meta">${p.surface} m² · ${bedrooms} ch. · ${kind}</p>
                  </div>
                </a>
              </article>
            `
          }

          grid.innerHTML = items.map(toCard).join('')
          initPhotoSwipe(grid)
        } else {
          showStatus('Aucun bien à afficher pour le moment.')
        }
      } catch (err) {
        console.error('[apimo] getProperties() error:', err)
        if (!cancelled) {
          showStatus('Les biens n’ont pas pu être chargés. Consultez le catalogue pour voir l’offre en cours.')
        }
      }

      const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-biens-filter]'))
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[data-bien-card]'))

      const matchesFilter = (card: HTMLElement, filter: string) => {
        if (filter === 'all') return true
        if (filter === 'maison' || filter === 'appartement') return card.dataset.kind === filter
        if (filter === 'jardin') return card.dataset.jardin === 'true'
        if (filter === 'piscine') return card.dataset.piscine === 'true'
        if (filter === 'exclusive') return card.dataset.exclusive === 'true'
        return true
      }

      const applyFilter = (filter: string) => {
        cards.forEach((card) => {
          const visible = matchesFilter(card, filter)
          card.hidden = !visible
        })
        chips.forEach((chip) => {
          chip.classList.toggle('is-active', chip.dataset.biensFilter === filter)
        })
      }

      handlers = chips.map((chip) => {
        const onClick = () => applyFilter(chip.dataset.biensFilter || 'all')
        chip.addEventListener('click', onClick)
        return { chip, onClick }
      })

      setupSectionTitleTextReveal()
      setupSectionTitleUnderline()
      setupStatsCountAnimation()
      setupReveal('.section-header')
      setupReveal('.key-stats-banner__item', (index) => index * 0.15)
      setupReveal('[data-bien-card]', (index) => index * 0.15)
      setupReveal('.home-team-preview__card', (index) => Math.min(index * 0.12, 1.2), { fromY: 50, fromScale: 1 })
    }

    initFeatured()

    return () => {
      cancelled = true
      unmountPrivateVisits()
      if (interval) window.clearInterval(interval)
      teardownTemoignagesCarousel?.()
      handlers.forEach(({ chip, onClick }) => chip.removeEventListener('click', onClick))
      observers.forEach((observer) => observer.disconnect())
    }
  }, [])

  return <main dangerouslySetInnerHTML={{ __html: html }} />
}
