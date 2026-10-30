/**
 * Récupère note + avis Google (Places API New) → data/google-reviews.json
 * Tourne au build Vercel (GOOGLE_PLACES_API_KEY). En local : .env.local
 * Si la clé manque ou l'API échoue : on garde le JSON précédent, build non bloqué.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles } from './load-env'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'data', 'google-reviews.json')

const PLACE_QUERY = 'Hamac Investissements & Patrimoine Sainte-Foy-lès-Lyon'
const PLACE_CENTER = { latitude: 45.7351169, longitude: 4.8047996 }
const MAPS_URL =
  'https://www.google.com/maps/place/Hamac+Investissements+%26+Patrimoine/@45.7351169,4.8047996,17z/data=!4m6!3m5!1s0x47f4ebb008803cad:0xc09af1384c99bcfe!8m2!3d45.7351169!4d4.8047996!16s%2Fg%2F11k9n6qynb'

export type GoogleReviewFile = {
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

type SearchPlace = {
  id?: string
  name?: string
  displayName?: { text?: string }
  rating?: number
  userRatingCount?: number
}

type PlaceReview = {
  name?: string
  rating?: number
  text?: { text?: string }
  originalText?: { text?: string }
  relativePublishTimeDescription?: string
  authorAttribution?: { displayName?: string; uri?: string }
}

loadEnvFiles(ROOT)

async function readPrevious(): Promise<GoogleReviewFile | null> {
  try {
    const raw = await readFile(OUT, 'utf8')
    return JSON.parse(raw) as GoogleReviewFile
  } catch {
    return null
  }
}

async function searchPlaceId(apiKey: string): Promise<string> {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.name,places.displayName',
    },
    body: JSON.stringify({
      textQuery: PLACE_QUERY,
      locationBias: {
        circle: { center: PLACE_CENTER, radius: 500 },
      },
      maxResultCount: 3,
      languageCode: 'fr',
    }),
  })
  const payload = (await response.json()) as { places?: SearchPlace[]; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`searchText HTTP ${response.status}: ${payload.error?.message ?? 'erreur'}`)
  }
  const place = payload.places?.[0]
  const resource = place?.name || (place?.id ? `places/${place.id}` : '')
  if (!resource) throw new Error('searchText : aucun établissement trouvé')
  return resource
}

async function fetchPlaceDetails(apiKey: string, resourceName: string) {
  const response = await fetch(`https://places.googleapis.com/v1/${resourceName}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,name,displayName,rating,userRatingCount,reviews',
    },
  })
  const payload = (await response.json()) as {
    id?: string
    name?: string
    displayName?: { text?: string }
    rating?: number
    userRatingCount?: number
    reviews?: PlaceReview[]
    error?: { message?: string }
  }
  if (!response.ok) {
    throw new Error(`place details HTTP ${response.status}: ${payload.error?.message ?? 'erreur'}`)
  }
  return payload
}

function mapReviews(reviews: PlaceReview[] | undefined) {
  return (reviews ?? [])
    .map((review, index) => {
      const quote = (review.text?.text || review.originalText?.text || '').trim()
      const author = (review.authorAttribution?.displayName || 'Client Google').trim()
      const rating = typeof review.rating === 'number' ? review.rating : 5
      if (!quote) return null
      return {
        id: review.name || `google-${index}`,
        rating,
        quote: quote.startsWith('«') ? quote : `« ${quote} »`,
        author,
        relativeTime: review.relativePublishTimeDescription,
        authorUri: review.authorAttribution?.uri,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
}

async function main() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim()
  const previous = await readPrevious()

  if (!apiKey || apiKey === '[SENSITIVE]') {
    if (previous?.reviews?.length) {
      console.warn('GOOGLE_PLACES_API_KEY absent : conservation de data/google-reviews.json')
      return
    }
    console.warn('GOOGLE_PLACES_API_KEY absent : aucun avis Google synchronisé')
    return
  }

  try {
    const resource =
      previous?.placeId && previous.placeId.startsWith('places/')
        ? previous.placeId
        : previous?.placeId
          ? `places/${previous.placeId}`
          : await searchPlaceId(apiKey)

    const details = await fetchPlaceDetails(apiKey, resource)
    const placeId = details.name || resource
    const file: GoogleReviewFile = {
      generatedAt: new Date().toISOString(),
      placeId,
      placeName: details.displayName?.text || 'Hamac Investissements & Patrimoine',
      rating: typeof details.rating === 'number' ? details.rating : previous?.rating ?? 0,
      userRatingCount:
        typeof details.userRatingCount === 'number'
          ? details.userRatingCount
          : previous?.userRatingCount ?? 0,
      mapsUrl: MAPS_URL,
      reviews: mapReviews(details.reviews),
    }

    if (!file.reviews.length && previous?.reviews?.length) {
      console.warn('API sans avis textuels : conservation des avis précédents, note mise à jour')
      file.reviews = previous.reviews
    }

    await mkdir(path.dirname(OUT), { recursive: true })
    await writeFile(OUT, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
    console.log(
      `google-reviews : ${file.rating}/5 (${file.userRatingCount} avis), ${file.reviews.length} textes → data/google-reviews.json`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (previous?.reviews?.length) {
      console.warn(`sync-google-reviews échoué (${message}) : JSON précédent conservé`)
      return
    }
    console.warn(`sync-google-reviews échoué (${message})`)
  }
}

await main()
