import { Play } from 'lucide-react'
import { PropertyVideo } from '../PropertyVideo'
import type { PrivateVisit } from '../../data/privateVisits'

type PrivateVisitCardProps = {
  visit: PrivateVisit
  index: number
  isCenter: boolean
  shouldPreload: boolean
  playInView: boolean
  onOpen: (index: number) => void
  cardRef: (node: HTMLButtonElement | null) => void
}

export function PrivateVisitCard({
  visit,
  index,
  isCenter,
  shouldPreload,
  playInView,
  onOpen,
  cardRef,
}: PrivateVisitCardProps) {
  const hasStreamVideo = Boolean(visit.streamVideoId)
  const shouldMountVideo = hasStreamVideo && playInView && shouldPreload
  const showVideo = hasStreamVideo && playInView && isCenter

  return (
    <button
      type="button"
      ref={cardRef}
      className={`private-visits-card ${isCenter ? 'is-center' : ''} ${showVideo ? 'is-previewing' : ''}`}
      role="listitem"
      onClick={() => onOpen(index)}
      aria-label={`Voir la visite privée de ${visit.title} à ${visit.commune}`}
    >
      <span className="private-visits-card__media">
        <img
          src={visit.posterSrc}
          alt=""
          loading="lazy"
          decoding="async"
          className="private-visits-card__poster"
        />
        {shouldMountVideo ? (
          <span className="private-visits-card__stream" aria-hidden>
            <PropertyVideo
              videoId={visit.streamVideoId!}
              title={visit.title}
              poster={visit.posterSrc}
              preview
              muted
              active={showVideo}
            />
          </span>
        ) : null}
        {!showVideo ? (
          <span className="private-visits-card__play" aria-hidden="true">
            <Play size={isCenter ? 28 : 22} fill="currentColor" />
          </span>
        ) : null}
        <span className="private-visits-card__badge">Vendu</span>
        <span className="private-visits-card__overlay" aria-hidden="true">
          {isCenter ? (
            <span className="private-visits-card__commune private-visits-card__commune--featured">
              {visit.commune}
            </span>
          ) : (
            <>
              <span className="private-visits-card__title">{visit.title}</span>
              <span className="private-visits-card__commune">{visit.commune}</span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}
