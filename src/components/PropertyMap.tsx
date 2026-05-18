import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { divIcon, latLngBounds } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Property } from '../data/properties'
import 'leaflet/dist/leaflet.css'

type PropertyMapProps = {
  properties: Property[]
  hoveredSlug: string | null
  onHoverChange: (slug: string | null) => void
  isVisible?: boolean
  /** When the map container resizes (e.g. catalogue expanded mode), Leaflet must invalidate its layout. */
  isExpanded?: boolean
}

const formatPriceCompact = (value: number) => `${Math.round(value / 1000)}k€`

const markerIcon = (label: string, highlighted = false) =>
  divIcon({
    className: '',
    html: `<span class="property-map__price-pill ${highlighted ? 'is-highlighted' : ''}">${label}</span>`,
    iconSize: [68, 28],
    iconAnchor: [34, 14],
  })

function FitBounds({ properties, isExpanded }: { properties: Property[]; isExpanded: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!properties.length) return
    const bounds = latLngBounds(properties.map((entry) => [entry.lat, entry.lng] as [number, number]))
    const padding: [number, number] = isExpanded ? [18, 18] : [40, 40]
    const maxZoom = isExpanded ? 17 : 14
    const opts = { padding, duration: 0.45, maxZoom }

    const run = () => {
      map.flyToBounds(bounds, opts)
    }

    if (isExpanded) {
      const t = window.setTimeout(run, 160)
      return () => window.clearTimeout(t)
    }
    run()
  }, [map, properties, isExpanded])
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
    const t3 = window.setTimeout(run, 480)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [isVisible, isExpanded, map])

  return null
}

export function PropertyMap({
  properties,
  hoveredSlug,
  onHoverChange,
  isVisible = true,
  isExpanded = false,
}: PropertyMapProps) {
  // TODO: coordinates will come from Apimo API
  const validProperties = useMemo(() => {
    return properties.filter(
      (p) =>
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        p.lat !== 0 &&
        p.lng !== 0,
    )
  }, [properties])

  const clusters = useMemo(() => {
    const byKey = new Map<string, Property[]>()
    validProperties.forEach((property) => {
      const key = `${property.lat.toFixed(2)}:${property.lng.toFixed(2)}`
      const current = byKey.get(key) ?? []
      current.push(property)
      byKey.set(key, current)
    })
    return Array.from(byKey.values())
  }, [validProperties])

  return (
    <div className="property-map">
      <MapContainer center={[45.75, 4.79]} zoom={12} className="property-map__canvas" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="property-map__tiles"
        />
        <InvalidateMapLayout isVisible={isVisible} isExpanded={isExpanded} />
        <FitBounds properties={validProperties} isExpanded={isExpanded} />
        {clusters.map((group) => {
          const first = group[0]
          if (!first) return null
          const isCluster = group.length > 1
          const label = isCluster ? `${group.length} biens` : formatPriceCompact(first.price)
          const isHighlighted = group.some((entry) => entry.slug === hoveredSlug)
          return (
            <Marker
              key={`${first.slug}-${group.length}`}
              position={[first.lat, first.lng]}
              icon={markerIcon(label, isHighlighted)}
              eventHandlers={{
                mouseover: () => onHoverChange(first.slug),
                mouseout: () => onHoverChange(null),
              }}
            >
              <Popup>
                {isCluster ? (
                  <div className="property-map__popup-list">
                    <p>{group.length} biens dans ce secteur</p>
                    {group.slice(0, 3).map((property) => (
                      <Link key={property.slug} to={`/acheter/${property.slug}`}>{property.title}</Link>
                    ))}
                  </div>
                ) : (
                  <article className="property-map__popup-card">
                    <img src={first.images[0]} alt={`Photo du bien ${first.title} à ${first.city}`} loading="lazy" />
                    <h4>{first.title}</h4>
                    <p className="price">{new Intl.NumberFormat('fr-FR').format(first.price)} €</p>
                    <p>{first.surface} m² · {first.rooms} pièces</p>
                    <Link to={`/acheter/${first.slug}`}>Voir le bien →</Link>
                  </article>
                )}
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
      {!validProperties.length ? (
        <div className="property-map__empty">
          <p>Aucun bien ne correspond à vos filtres actuellement.</p>
        </div>
      ) : null}
    </div>
  )
}
