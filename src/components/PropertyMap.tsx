import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { divIcon, latLngBounds } from 'leaflet'
import type { LeafletEvent, Marker as LeafletMarker } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Property } from '../data/properties'
import 'leaflet/dist/leaflet.css'

type MapViewState = { center: [number, number]; zoom: number }

type PropertyMapProps = {
  properties: Property[]
  hoveredSlug: string | null
  onHoverChange: (slug: string | null) => void
  isVisible?: boolean
  /** When the map container resizes (e.g. catalogue map view), Leaflet must invalidate its layout. */
  isExpanded?: boolean
  initialCenter?: [number, number]
  initialZoom?: number
  onViewChange?: (view: MapViewState) => void
  fitPadding?: { topLeft: [number, number]; bottomRight: [number, number] }
}

const formatPriceLabel = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} €`

const markerIcon = (label: string, highlighted = false, isCluster = false) =>
  divIcon({
    className: '',
    html: `<span class="property-map__price-pill ${isCluster ? 'is-cluster' : ''} ${highlighted ? 'is-highlighted' : ''}">${label}</span>`,
    iconSize: [100, 32],
    iconAnchor: [50, 16],
  })

function boundsKeyFromProperties(properties: Property[]) {
  return properties
    .map((entry) => `${entry.slug}:${entry.lat.toFixed(4)}:${entry.lng.toFixed(4)}`)
    .sort()
    .join('|')
}

/** Plus le zoom est élevé, plus la grille de regroupement est fine (les marqueurs se séparent). */
function clusterDecimalsForZoom(zoom: number): number | null {
  if (zoom >= 16) return null
  if (zoom >= 14) return 4
  if (zoom >= 12) return 3
  return 2
}

function groupProperties(properties: Property[], decimals: number | null): Property[][] {
  const byKey = new Map<string, Property[]>()
  properties.forEach((property) => {
    const key =
      decimals === null
        ? `${property.lat.toFixed(5)}:${property.lng.toFixed(5)}`
        : `${property.lat.toFixed(decimals)}:${property.lng.toFixed(decimals)}`
    const current = byKey.get(key) ?? []
    current.push(property)
    byKey.set(key, current)
  })
  return Array.from(byKey.values())
}

/** Décale légèrement les marqueurs au même point pour les rendre visibles au zoom fort. */
function spreadOverlappingGroup(group: Property[]): Array<{ property: Property; lat: number; lng: number }> {
  if (group.length <= 1) {
    const only = group[0]
    return only ? [{ property: only, lat: only.lat, lng: only.lng }] : []
  }

  const centerLat = group.reduce((sum, entry) => sum + entry.lat, 0) / group.length
  const centerLng = group.reduce((sum, entry) => sum + entry.lng, 0) / group.length
  const radiusDeg = 22 / 111_320
  const lngScale = Math.cos((centerLat * Math.PI) / 180)

  return group.map((property, index) => {
    const angle = (2 * Math.PI * index) / group.length
    return {
      property,
      lat: centerLat + radiusDeg * Math.sin(angle),
      lng: centerLng + (radiusDeg * Math.cos(angle)) / lngScale,
    }
  })
}

type MapMarkerModel =
  | { kind: 'single'; property: Property; lat: number; lng: number }
  | { kind: 'cluster'; group: Property[]; lat: number; lng: number }

function buildMarkerModels(properties: Property[], zoom: number): MapMarkerModel[] {
  const decimals = clusterDecimalsForZoom(zoom)
  const groups = groupProperties(properties, decimals)
  const models: MapMarkerModel[] = []

  groups.forEach((group) => {
    if (group.length > 1 && decimals !== null) {
      const lat = group.reduce((sum, entry) => sum + entry.lat, 0) / group.length
      const lng = group.reduce((sum, entry) => sum + entry.lng, 0) / group.length
      models.push({ kind: 'cluster', group, lat, lng })
      return
    }

    spreadOverlappingGroup(group).forEach((entry) => {
      models.push({ kind: 'single', property: entry.property, lat: entry.lat, lng: entry.lng })
    })
  })

  return models
}

function FitBounds({
  properties,
  isExpanded,
  fitBoundsKey,
  skipFitOnMount,
  programmaticFitRef,
  fitPadding,
}: {
  properties: Property[]
  isExpanded: boolean
  fitBoundsKey: string
  skipFitOnMount: boolean
  programmaticFitRef: { current: boolean }
  fitPadding?: { topLeft: [number, number]; bottomRight: [number, number] }
}) {
  const map = useMap()
  const lastFittedKeyRef = useRef<string | null>(null)
  const expandedFitKeyRef = useRef<string | null>(null)
  const userAdjustedViewRef = useRef(false)
  const skippedInitialFitRef = useRef(false)

  useEffect(() => {
    const markUserAdjusted = (event: LeafletEvent) => {
      if (programmaticFitRef.current) return
      const original = (event as LeafletEvent & { originalEvent?: Event }).originalEvent
      if (original) userAdjustedViewRef.current = true
    }

    map.on('zoomstart', markUserAdjusted)
    map.on('dragstart', markUserAdjusted)
    return () => {
      map.off('zoomstart', markUserAdjusted)
      map.off('dragstart', markUserAdjusted)
    }
  }, [map, programmaticFitRef])

  useEffect(() => {
    if (!properties.length) {
      lastFittedKeyRef.current = null
      expandedFitKeyRef.current = null
      if (!skipFitOnMount) userAdjustedViewRef.current = false
      return
    }

    if (skipFitOnMount && !skippedInitialFitRef.current) {
      skippedInitialFitRef.current = true
      lastFittedKeyRef.current = fitBoundsKey
      if (isExpanded) expandedFitKeyRef.current = fitBoundsKey
      return
    }

    const isNewDataset = lastFittedKeyRef.current !== fitBoundsKey
    const shouldFitExpanded = isExpanded && expandedFitKeyRef.current !== fitBoundsKey

    if (!isNewDataset && !shouldFitExpanded) return
    if (userAdjustedViewRef.current && !isNewDataset) return

    const bounds = latLngBounds(properties.map((entry) => [entry.lat, entry.lng] as [number, number]))
    const paddingTopLeft = fitPadding?.topLeft ?? [24, 24]
    const paddingBottomRight = fitPadding?.bottomRight ?? [24, 24]
    const maxZoom = isExpanded ? 17 : 14

    const run = () => {
      programmaticFitRef.current = true
      map.flyToBounds(bounds, { paddingTopLeft, paddingBottomRight, duration: 0.45, maxZoom })
      lastFittedKeyRef.current = fitBoundsKey
      if (isExpanded) expandedFitKeyRef.current = fitBoundsKey
      window.setTimeout(() => {
        programmaticFitRef.current = false
      }, 500)
    }

    if (isExpanded && (isNewDataset || shouldFitExpanded)) {
      const timer = window.setTimeout(run, 180)
      return () => window.clearTimeout(timer)
    }

    if (isNewDataset) {
      run()
    }
  }, [
    map,
    fitBoundsKey,
    isExpanded,
    properties.length,
    skipFitOnMount,
    programmaticFitRef,
    fitPadding?.topLeft[0],
    fitPadding?.topLeft[1],
    fitPadding?.bottomRight[0],
    fitPadding?.bottomRight[1],
  ])
  return null
}

function MapViewReporter({
  onViewChange,
  programmaticFitRef,
}: {
  onViewChange?: (view: MapViewState) => void
  programmaticFitRef: { current: boolean }
}) {
  const map = useMap()
  const timerRef = useRef<number | null>(null)

  useMapEvents({
    moveend: () => {
      if (!onViewChange || programmaticFitRef.current) return
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        const center = map.getCenter()
        onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() })
      }, 200)
    },
    zoomend: () => {
      if (!onViewChange || programmaticFitRef.current) return
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        const center = map.getCenter()
        onViewChange({ center: [center.lat, center.lng], zoom: map.getZoom() })
      }, 200)
    },
  })

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    [],
  )

  return null
}

function InvalidateMapLayout({ isVisible, isExpanded }: { isVisible: boolean; isExpanded: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!isVisible) return
    const run = () => {
      map.invalidateSize({ pan: false })
    }
    const t1 = window.setTimeout(run, 50)
    const t2 = window.setTimeout(run, 220)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isVisible, isExpanded, map])

  useEffect(() => {
    const el = map.getContainer()
    let timer: number | null = null
    const observer = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        map.invalidateSize({ pan: false })
      }, 100)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer) window.clearTimeout(timer)
    }
  }, [map])

  return null
}

function PropertyMapMarker({
  model,
  hoveredSlug,
  onHoverChange,
}: {
  model: MapMarkerModel
  hoveredSlug: string | null
  onHoverChange: (slug: string | null) => void
}) {
  const map = useMap()
  const markerRef = useRef<LeafletMarker>(null)
  const closeTimerRef = useRef<number | null>(null)
  const isCluster = model.kind === 'cluster'
  const group = isCluster ? model.group : [model.property]
  const first = group[0]
  if (!first) return null

  const label = isCluster ? `${group.length} biens` : formatPriceLabel(first.price)
  const isHighlighted = group.some((entry) => entry.slug === hoveredSlug)

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const openPopup = () => markerRef.current?.openPopup()
  const closePopup = () => markerRef.current?.closePopup()
  const scheduleClosePopup = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      onHoverChange(null)
      closePopup()
    }, 700)
  }

  useEffect(() => {
    if (isHighlighted) {
      clearCloseTimer()
      openPopup()
      return
    }
    closePopup()
  }, [isHighlighted])

  useEffect(() => () => clearCloseTimer(), [])

  const zoomIntoCluster = () => {
    const targetZoom = Math.min(map.getZoom() + 2, 17)
    map.flyTo([model.lat, model.lng], targetZoom, { duration: 0.4 })
  }

  return (
    <Marker
      ref={markerRef}
      position={[model.lat, model.lng]}
      icon={markerIcon(label, isHighlighted, isCluster)}
      eventHandlers={{
        mouseover: () => {
          if (isCluster) return
          clearCloseTimer()
          onHoverChange(first.slug)
          openPopup()
        },
        mouseout: () => {
          if (isCluster) return
          scheduleClosePopup()
        },
        click: () => {
          clearCloseTimer()
          if (isCluster) {
            zoomIntoCluster()
            return
          }
          onHoverChange(first.slug)
          openPopup()
        },
      }}
    >
      <Popup
        closeButton
        autoClose={false}
        closeOnClick={false}
        className="property-map__popup"
        eventHandlers={{
          mouseover: () => {
            clearCloseTimer()
            if (!isCluster) onHoverChange(first.slug)
          },
          mouseout: scheduleClosePopup,
        }}
      >
        {isCluster ? (
          <div
            className="property-map__popup-list"
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClosePopup}
          >
            <p>{group.length} biens dans ce secteur</p>
            <p className="property-map__popup-hint">Cliquez sur le marqueur pour zoomer et voir chaque bien.</p>
            {group.slice(0, 3).map((property) => (
              <Link key={property.slug} to={`/acheter/${property.slug}`}>
                {property.title}
              </Link>
            ))}
          </div>
        ) : (
          <article
            className="property-map__popup-card"
            onMouseEnter={() => {
              clearCloseTimer()
              onHoverChange(first.slug)
            }}
            onMouseLeave={scheduleClosePopup}
          >
            <img src={first.images[0]} alt={`Photo du bien ${first.title} à ${first.city}`} loading="lazy" />
            <h4>{first.title}</h4>
            <p className="price">{formatPriceLabel(first.price)}</p>
            <p>
              {first.surface} m² · {first.rooms} pièces
            </p>
            <Link to={`/acheter/${first.slug}`}>Voir le bien →</Link>
          </article>
        )}
      </Popup>
    </Marker>
  )
}

function PropertyMapMarkers({
  properties,
  hoveredSlug,
  onHoverChange,
}: {
  properties: Property[]
  hoveredSlug: string | null
  onHoverChange: (slug: string | null) => void
}) {
  const map = useMap()
  const [zoom, setZoom] = useState(() => map.getZoom())

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  })

  const markerModels = useMemo(() => buildMarkerModels(properties, zoom), [properties, zoom])

  return (
    <>
      {markerModels.map((model) => (
        <PropertyMapMarker
          key={
            model.kind === 'cluster'
              ? `cluster-${model.lat.toFixed(5)}-${model.lng.toFixed(5)}-${model.group.map((entry) => entry.slug).join('-')}`
              : model.property.slug
          }
          model={model}
          hoveredSlug={hoveredSlug}
          onHoverChange={onHoverChange}
        />
      ))}
    </>
  )
}

export function PropertyMap({
  properties,
  hoveredSlug,
  onHoverChange,
  isVisible = true,
  isExpanded = false,
  initialCenter,
  initialZoom,
  onViewChange,
  fitPadding,
}: PropertyMapProps) {
  const programmaticFitRef = useRef(false)
  const hasInitialView =
    Array.isArray(initialCenter) &&
    initialCenter.length === 2 &&
    Number.isFinite(initialCenter[0]) &&
    Number.isFinite(initialCenter[1]) &&
    typeof initialZoom === 'number' &&
    Number.isFinite(initialZoom)

  const validProperties = useMemo(() => {
    return properties.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0 && p.lng !== 0,
    )
  }, [properties])

  const fitBoundsKey = useMemo(() => boundsKeyFromProperties(validProperties), [validProperties])

  return (
    <div className="property-map">
      <MapContainer
        center={hasInitialView && initialCenter ? initialCenter : [45.75, 4.79]}
        zoom={hasInitialView && initialZoom != null ? initialZoom : 12}
        className="property-map__canvas"
        scrollWheelZoom={isExpanded}
        dragging={isExpanded}
        touchZoom={isExpanded}
        doubleClickZoom={isExpanded}
        boxZoom={isExpanded}
        keyboard={isExpanded}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="property-map__tiles"
        />
        <InvalidateMapLayout isVisible={isVisible} isExpanded={isExpanded} />
        <FitBounds
          properties={validProperties}
          isExpanded={isExpanded}
          fitBoundsKey={fitBoundsKey}
          skipFitOnMount={hasInitialView}
          programmaticFitRef={programmaticFitRef}
          fitPadding={fitPadding}
        />
        {onViewChange ? (
          <MapViewReporter onViewChange={onViewChange} programmaticFitRef={programmaticFitRef} />
        ) : null}
        <PropertyMapMarkers
          properties={validProperties}
          hoveredSlug={hoveredSlug}
          onHoverChange={onHoverChange}
        />
      </MapContainer>
      {!validProperties.length ? (
        <div className="property-map__empty">
          <p>Aucun bien ne correspond à vos filtres actuellement.</p>
        </div>
      ) : null}
    </div>
  )
}
