import { Link } from 'react-router-dom'
import type { Property } from '../data/properties'

const formatPrice = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} €`

type PropertyCardProps = {
  property: Property
  light?: boolean
  highlighted?: boolean
  onHoverChange?: (slug: string | null) => void
  priorityImage?: boolean
}

export function PropertyCard({ property, light = false, highlighted = false, onHoverChange, priorityImage = false }: PropertyCardProps) {
  return (
    <article
      className={`bien-card ${light ? 'bien-card--light' : ''} ${highlighted ? 'is-map-highlighted' : ''}`}
      onMouseEnter={() => onHoverChange?.(property.slug)}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <Link to={`/acheter/${property.slug}`} className="bien-card__link">
        <div className="bien-card__img">
          <img src={property.images[0]} alt={`${property.title} à ${property.city}`} loading={priorityImage ? 'eager' : 'lazy'} />
        </div>
        <div className="bien-card__body">
          <p className="bien-card__price">{formatPrice(property.price)}</p>
          <h3 className="bien-card__title">{property.title} — {property.city}</h3>
          <p className="bien-card__meta">{property.surface} m² · {property.bedrooms} ch. · {property.type}</p>
        </div>
      </Link>
    </article>
  )
}
