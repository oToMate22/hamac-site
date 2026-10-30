import type { ClientReview } from './clientReviews'
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

export function googleReviewsAsClientReviews(): ClientReview[] {
  return GOOGLE_REVIEWS.reviews.map((review) => ({
    id: review.id,
    quote: review.quote,
    author: review.relativeTime ? `${review.author} — ${review.relativeTime}` : review.author,
    rating: review.rating,
  }))
}

export function hasGoogleReviews() {
  return GOOGLE_REVIEWS.reviews.length > 0 && GOOGLE_REVIEWS.rating > 0
}
