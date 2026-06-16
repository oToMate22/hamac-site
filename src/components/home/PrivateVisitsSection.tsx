import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FEATURED_PRIVATE_VISIT_ID, privateVisits } from '../../data/privateVisits'
import { PrivateVisitCard } from './PrivateVisitCard'
import { PrivateVisitsLightbox } from './PrivateVisitsLightbox'

const featuredIndex = privateVisits.findIndex((visit) => visit.id === FEATURED_PRIVATE_VISIT_ID)

export function PrivateVisitsSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null)
  const scrollRafRef = useRef<number | null>(null)

  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [centerIndex, setCenterIndex] = useState(featuredIndex >= 0 ? featuredIndex : 0)
  const [sectionInView, setSectionInView] = useState(false)

  const scrollCardToCenter = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const track = trackRef.current
    const card = cardRefs.current[index]
    if (!track || !card) return

    const target = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2
    track.scrollTo({ left: Math.max(0, target), behavior })
    setCenterIndex(index)
  }, [])

  const updateCenterFromScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const cards = cardRefs.current
    const trackCenter = track.scrollLeft + track.clientWidth / 2
    let nextCenter = 0
    let minDistance = Number.POSITIVE_INFINITY

    cards.forEach((card, index) => {
      if (!card) return
      const cardCenter = card.offsetLeft + card.offsetWidth / 2
      const distance = Math.abs(cardCenter - trackCenter)
      if (distance < minDistance) {
        minDistance = distance
        nextCenter = index
      }
    })

    setCenterIndex(nextCenter)
  }, [])

  const onTrackScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null
      updateCenterFromScroll()
    })
  }, [updateCenterFromScroll])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setSectionInView(entry.isIntersecting && entry.intersectionRatio >= 0.35)
      },
      { threshold: [0, 0.35, 0.55] },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const featured = featuredIndex >= 0 ? featuredIndex : 0
    const run = () => scrollCardToCenter(featured, 'auto')

    run()
    window.addEventListener('resize', run)
    return () => window.removeEventListener('resize', run)
  }, [scrollCardToCenter])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    track.addEventListener('scroll', onTrackScroll, { passive: true })
    return () => {
      track.removeEventListener('scroll', onTrackScroll)
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current)
      }
    }
  }, [onTrackScroll])

  const scrollByStep = (direction: -1 | 1) => {
    const next = Math.min(privateVisits.length - 1, Math.max(0, centerIndex + direction))
    scrollCardToCenter(next)
  }

  const openVisit = (index: number) => {
    lastTriggerRef.current = cardRefs.current[index] ?? null
    setActiveIndex(index)
  }

  const playInView = sectionInView

  return (
    <section
      ref={sectionRef}
      className="section section--cream home-private-visits"
      id="visites-privees"
      aria-labelledby="private-visits-title"
    >
      <div className="container home-private-visits__header">
        <div>
          <p className="eyebrow home-private-visits__eyebrow">Ventes réalisées</p>
          <h2 id="private-visits-title" className="home-private-visits__title">
            Visites privées
          </h2>
          <p className="home-private-visits__subtitle">Nos dernières ventes filmées en immersion</p>
        </div>

        <div className="home-private-visits__controls">
          <button
            type="button"
            className="home-private-visits__arrow"
            onClick={() => scrollByStep(-1)}
            aria-label="Visite précédente"
            disabled={centerIndex <= 0}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="home-private-visits__arrow"
            onClick={() => scrollByStep(1)}
            aria-label="Visite suivante"
            disabled={centerIndex >= privateVisits.length - 1}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="home-private-visits__carousel">
        <div ref={trackRef} className="home-private-visits__track" role="list">
          {privateVisits.map((visit, index) => {
            const isCenter = index === centerIndex
            const shouldPreload = Math.abs(index - centerIndex) <= 1

            return (
              <PrivateVisitCard
                key={visit.id}
                visit={visit}
                index={index}
                isCenter={isCenter}
                shouldPreload={shouldPreload}
                playInView={playInView}
                onOpen={openVisit}
                cardRef={(node) => {
                  cardRefs.current[index] = node
                }}
              />
            )
          })}
        </div>
      </div>

      <PrivateVisitsLightbox
        visits={privateVisits}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        triggerRef={lastTriggerRef}
      />
    </section>
  )
}
