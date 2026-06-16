import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useRef, type RefObject, type TouchEvent } from 'react'
import { PropertyVideo } from '../PropertyVideo'
import type { PrivateVisit } from '../../data/privateVisits'

type PrivateVisitsLightboxProps = {
  visits: PrivateVisit[]
  activeIndex: number | null
  onActiveIndexChange: (index: number | null) => void
  triggerRef: RefObject<HTMLElement | null>
}

function formatSoldDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(value))
}

export function PrivateVisitsLightbox({
  visits,
  activeIndex,
  onActiveIndexChange,
  triggerRef,
}: PrivateVisitsLightboxProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const open = activeIndex !== null
  const visit = activeIndex !== null ? visits[activeIndex] : null

  const goTo = useCallback(
    (nextIndex: number) => {
      if (!visits.length) return
      const wrapped = (nextIndex + visits.length) % visits.length
      onActiveIndexChange(wrapped)
    },
    [onActiveIndexChange, visits.length],
  )

  const close = useCallback(() => {
    onActiveIndexChange(null)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [onActiveIndexChange, triggerRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (activeIndex !== null) goTo(activeIndex - 1)
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (activeIndex !== null) goTo(activeIndex + 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, close, goTo, open])

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartRef.current
    if (!start || activeIndex === null) return
    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    touchStartRef.current = null

    if (Math.abs(deltaX) < 40 && Math.abs(deltaY) < 40) return

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      if (deltaX > 0) goTo(activeIndex - 1)
      else goTo(activeIndex + 1)
      return
    }

    if (deltaY < 0) goTo(activeIndex + 1)
    else goTo(activeIndex - 1)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) close()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="private-visits-lightbox__overlay" />
        <Dialog.Content
          className="private-visits-lightbox"
          aria-describedby={visit ? 'private-visits-lightbox-desc' : undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <Dialog.Title className="visually-hidden">
            {visit ? `Visite privée — ${visit.title}` : 'Visite privée'}
          </Dialog.Title>

          <button
            type="button"
            className="private-visits-lightbox__close"
            onClick={close}
            aria-label="Fermer la visite privée"
          >
            <X size={22} aria-hidden />
          </button>

          {activeIndex !== null && visits.length > 1 ? (
            <>
              <button
                type="button"
                className="private-visits-lightbox__nav private-visits-lightbox__nav--prev"
                onClick={() => goTo(activeIndex - 1)}
                aria-label="Visite précédente"
              >
                <ChevronLeft size={28} aria-hidden />
              </button>
              <button
                type="button"
                className="private-visits-lightbox__nav private-visits-lightbox__nav--next"
                onClick={() => goTo(activeIndex + 1)}
                aria-label="Visite suivante"
              >
                <ChevronRight size={28} aria-hidden />
              </button>
            </>
          ) : null}

          {visit ? (
            <div className="private-visits-lightbox__body">
              <div className="private-visits-lightbox__media">
                {visit.streamVideoId ? (
                  <PropertyVideo
                    key={visit.id}
                    videoId={visit.streamVideoId}
                    title={visit.title}
                    poster={visit.posterSrc}
                    className="private-visits-lightbox__player"
                  />
                ) : (
                  <>
                    <img
                      src={visit.posterSrc}
                      alt={`Aperçu — ${visit.title}, ${visit.commune}`}
                      className="private-visits-lightbox__poster-fallback"
                    />
                    <p className="private-visits-lightbox__missing">
                      Vidéo bientôt disponible — ajoutez un{' '}
                      <code>streamVideoId</code> dans{' '}
                      <code>src/data/privateVisits.ts</code>
                    </p>
                  </>
                )}
              </div>

              <div className="private-visits-lightbox__meta" id="private-visits-lightbox-desc">
                <h3 className="private-visits-lightbox__title">{visit.title}</h3>
                <p className="private-visits-lightbox__commune">{visit.commune}</p>
                <ul className="private-visits-lightbox__facts">
                  {visit.soldDate ? <li>Vendu — {formatSoldDate(visit.soldDate)}</li> : null}
                  {visit.surface ? <li>{visit.surface} m²</li> : null}
                  {visit.rooms ? <li>{visit.rooms} pièces</li> : null}
                </ul>
                {visit.description ? <p className="private-visits-lightbox__description">{visit.description}</p> : null}
              </div>
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
