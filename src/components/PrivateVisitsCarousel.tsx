import { useCallback, useEffect, useRef, useState } from 'react'
import type { Swiper as SwiperInstance } from 'swiper'
import {
  EffectCoverflow,
  Keyboard,
  Mousewheel,
  Navigation,
  Pagination,
} from 'swiper/modules'
import { SwiperSlide } from 'swiper/react'

import 'swiper/css/navigation'
import {
  FEATURED_PRIVATE_VISIT_ID,
  privateVisits,
  type PrivateVisit,
} from '../data/privateVisits'
import { PropertyVideo } from './PropertyVideo'
import { PrivateVisitsLightbox } from './home/PrivateVisitsLightbox'
import { SwiperCoverflow } from './SwiperCoverflow'

import './PrivateVisitsCarousel.css'

const featuredIndex = Math.max(
  0,
  privateVisits.findIndex((visit) => visit.id === FEATURED_PRIVATE_VISIT_ID),
)

/** Mobile : swipe tactile. Desktop : drag souris + molette / trackpad. */
const SWIPER_INTERACTION = {
  simulateTouch: true,
  allowTouchMove: true,
  touchRatio: 1,
  touchAngle: 45,
  threshold: 5,
  longSwipes: true,
  longSwipesRatio: 0.35,
  shortSwipes: true,
  followFinger: true,
  watchSlidesProgress: true,
  mousewheel: {
    enabled: true,
    forceToAxis: true,
    sensitivity: 1,
    thresholdDelta: 12,
    releaseOnEdges: true,
  },
}

type VisitSlideProps = {
  visit: PrivateVisit
  isActive: boolean
  showVideo: boolean
}

function VisitSlide({ visit, isActive, showVideo }: VisitSlideProps) {
  const shouldPlay = isActive && showVideo && Boolean(visit.streamVideoId)

  return (
    <div
      className={`visit-card ${isActive ? 'is-active' : ''} ${shouldPlay ? 'is-playing' : ''}`}
    >
      <span className="visit-card__media">
        <img
          src={visit.posterSrc}
          alt=""
          className="visit-poster"
          loading={isActive ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
        />
        {shouldPlay ? (
          <PropertyVideo
            key={visit.id}
            videoId={visit.streamVideoId!}
            title={visit.title}
            poster={visit.posterSrc}
            preview
            muted
          />
        ) : null}
      </span>

      <span className="visit-caption">
        <span className="visit-city">{visit.commune}</span>
      </span>
    </div>
  )
}

export function PrivateVisitsCarousel() {
  const sectionRef = useRef<HTMLElement>(null)
  const lastTriggerRef = useRef<HTMLDivElement | null>(null)

  const [activeIndex, setActiveIndex] = useState(featuredIndex)
  const [sectionVisible, setSectionVisible] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const canPlayVideo = sectionVisible && lightboxIndex === null

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const observer = new IntersectionObserver(
      ([entry]) => setSectionVisible(entry.isIntersecting),
      { threshold: 0.12 },
    )

    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  /** onTap = clic sans drag — n’interfère pas avec le glisser souris */
  const handleSwiperTap = useCallback(
    (swiper: SwiperInstance, event: MouseEvent | TouchEvent | PointerEvent) => {
      const clickedSlide = (event.target as HTMLElement).closest('.swiper-slide')
      if (!clickedSlide?.classList.contains('swiper-slide-active')) return

      lastTriggerRef.current =
        clickedSlide.querySelector<HTMLDivElement>('.visit-card') ?? null
      setLightboxIndex(swiper.activeIndex)
    },
    [],
  )

  return (
    <section ref={sectionRef} className="private-visits-section" id="visites-privees">
      <div className="container">
        <header className="section-header">
          <p className="section-eyebrow">Ventes réalisées</p>
          <h2 className="section-title">Visites privées</h2>
          <p className="section-subtitle">Nos dernières ventes filmées en immersion</p>
        </header>

        <div className="private-visits-swiper-wrap">
          <SwiperCoverflow
            className="mySwiper private-visits-swiper"
            modules={[EffectCoverflow, Pagination, Navigation, Keyboard, Mousewheel]}
            coverflowEffect={{
              rotate: 42,
              stretch: -72,
              depth: 85,
              modifier: 1.15,
              slideShadows: true,
            }}
            initialSlide={featuredIndex}
            speed={450}
            spaceBetween={12}
            rewind
            resistance
            resistanceRatio={0.85}
            slideToClickedSlide
            keyboard={{ enabled: true, onlyInViewport: true }}
            navigation
            pagination={{ clickable: true }}
            onTap={handleSwiperTap}
            onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
            {...SWIPER_INTERACTION}
          >
            {privateVisits.map((visit, index) => (
              <SwiperSlide key={visit.id}>
                <VisitSlide
                  visit={visit}
                  isActive={activeIndex === index}
                  showVideo={canPlayVideo}
                />
              </SwiperSlide>
            ))}
          </SwiperCoverflow>
        </div>
      </div>

      <PrivateVisitsLightbox
        visits={privateVisits}
        activeIndex={lightboxIndex}
        onActiveIndexChange={(index) => {
          setLightboxIndex(index)
          if (index === null) {
            window.setTimeout(() => lastTriggerRef.current?.focus(), 0)
          }
        }}
        triggerRef={lastTriggerRef}
      />
    </section>
  )
}
