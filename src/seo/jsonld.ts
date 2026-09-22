import { AGENCY, SITE_NAME, SITE_URL, canonicalUrl, toAbsoluteUrl } from '../config/site'
import { HAMAC_SOCIAL_LINKS } from '../data/socialLinks'
import type { FeaturedProperty } from '../services/apimo'

export const realEstateAgentJsonLd = (areaServed?: string | string[]) => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: AGENCY.legalName,
  url: SITE_URL,
  image: toAbsoluteUrl('/fr/images/Logo/logo-hamac.webp'),
  telephone: AGENCY.telephone,
  email: AGENCY.email,
  address: {
    '@type': 'PostalAddress',
    streetAddress: AGENCY.street,
    postalCode: AGENCY.postalCode,
    addressLocality: AGENCY.city,
    addressCountry: 'FR',
  },
  areaServed: areaServed ?? AGENCY.areaServed,
  sameAs: HAMAC_SOCIAL_LINKS.map((link) => link.href),
})

export const listingJsonLd = (property: FeaturedProperty, pathname: string) => ({
  '@context': 'https://schema.org',
  '@type': 'RealEstateListing',
  name: `${property.title} à ${property.city}`,
  description: property.description?.slice(0, 300) ?? `${property.title} à ${property.city}`,
  url: canonicalUrl(pathname),
  image: property.images.map(toAbsoluteUrl),
  address: {
    '@type': 'PostalAddress',
    addressLocality: property.city,
    postalCode: property.zipcode,
    addressCountry: 'FR',
  },
  floorSize: {
    '@type': 'QuantitativeValue',
    value: property.surface,
    unitCode: 'MTK',
  },
  numberOfRooms: property.rooms,
  offers: {
    '@type': 'Offer',
    price: property.price,
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
  },
})

export const blogPostingJsonLd = (post: {
  title: string
  excerpt: string
  coverImage: string
  author: string
  publishedDate: string
  slug: string
}) => ({
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  description: post.excerpt,
  image: toAbsoluteUrl(post.coverImage),
  datePublished: post.publishedDate,
  author: {
    '@type': 'Person',
    name: post.author,
  },
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
  },
  url: canonicalUrl(`/blog/${post.slug}`),
})
