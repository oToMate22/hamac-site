import type { ClientReview } from './clientReviews'
import { CLIENT_REVIEWS } from './clientReviews'
import raw from '../../data/google-reviews.json'

export type GoogleReviewsSnapshot = {
  generatedAt: string
  placeId: string
  placeName: string
  rating: number
  userRatingCount: number
  mapsUrl: string
  reviews: Array<{
    id: string
    rating: number
    quote: string
    author: string
    relativeTime?: string
    authorUri?: string
  }>
}

export const GOOGLE_REVIEWS = raw as GoogleReviewsSnapshot

const MIN_RATING = 4

function normalizeQuote(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function quoteSubstance(quote: string) {
  return Math.min(quote.replace(/[«»""']/g, '').trim().length, 280)
}

/** Note d'abord, puis commentaires les plus riches. */
function rankReviews(reviews: ClientReview[]): ClientReview[] {
  return [...reviews].sort((a, b) => {
    const ratingA = a.rating ?? 0
    const ratingB = b.rating ?? 0
    if (ratingB !== ratingA) return ratingB - ratingA
    return quoteSubstance(b.quote) - quoteSubstance(a.quote)
  })
}

export function googleReviewsAsClientReviews(): ClientReview[] {
  return rankReviews(
    GOOGLE_REVIEWS.reviews
      .filter((review) => review.rating >= MIN_RATING && review.quote.trim().length >= 40)
      .map((review) => ({
        id: review.id,
        quote: review.quote,
        author: review.relativeTime ? `${review.author} — ${review.relativeTime}` : review.author,
        rating: review.rating,
      })),
  )
}

/**
 * Places API ≤ 5 avis : on prend les mieux notés / plus riches,
 * puis on complète avec les témoignages éditoriaux 5★.
 */
export function reviewsForCarousel(): ClientReview[] {
  const google = googleReviewsAsClientReviews()
  const curated = rankReviews(
    CLIENT_REVIEWS.filter((review) => (review.rating ?? 5) >= MIN_RATING),
  )

  if (!google.length) return curated

  const seen = new Set(google.map((review) => normalizeQuote(review.quote)))
  const extras = curated.filter((review) => !seen.has(normalizeQuote(review.quote)))
  return rankReviews([...google, ...extras])
}

export function hasGoogleReviews() {
  return GOOGLE_REVIEWS.reviews.length > 0
}

export function hasGoogleRating() {
  return Number.isFinite(GOOGLE_REVIEWS.rating) && GOOGLE_REVIEWS.rating > 0
}
