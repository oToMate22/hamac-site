/**
 * Contrats de typage du registre. Inclus par `tsc --noEmit`.
 * Ce module ne doit pas être importé par l'application : il n'a aucun effet utile au runtime.
 */
import type { AnalyticsEventName, EventParams } from './events'

type Track = typeof import('./track').track

function accepts(send: Track): void {
  send('page_view', {})

  send('property_view', {
    property_ref: '6973600',
    property_type: 'maison',
    listing_kind: 'sale',
    city: 'Écully',
  })

  send('property_search', {
    listing_kind: 'rent',
    results_count: 3,
    budget_max: 'rent_to_800',
    surface_min: '80',
    bedrooms_min: 3,
    sort: 'recent',
    view: 'map',
  })

  send('property_filter', { filter_axis: 'sort', sort: 'recent' })
  send('property_filter', { filter_axis: 'city', city: 'Écully' })
  send('property_filter', { filter_axis: 'city' })

  send('no_search_results', { listing_kind: 'sale', results_count: 0 })
  send('contact_submit', { form: 'contact' })
  send('property_inquiry_submit', { form: 'bien', property_ref: '6973600' })
  send('estimate_submit', {
    form: 'estimation',
    property_type: 'maison',
    surface: 80,
    rooms: 4,
    city: 'Écully',
  })
  send('offmarket_submit', {
    form: 'offmarket',
    property_type: 'Maison',
    sector: "Tout l'Ouest Lyonnais",
  })
  send('phone_click', { cta: 'nav_phone', page_type: 'home' })
  send('email_click', { cta: 'footer_email', page_type: 'legal' })
  send('form_error', { form: 'estimation', error_code: 'network' })
  send('generate_lead', { form: 'bien' })

  // @ts-expect-error property_ref est obligatoire
  send('property_view', { property_type: 'maison', listing_kind: 'sale' })

  send('property_view', {
    property_ref: '6973600',
    // @ts-expect-error le type catalogue n'accepte pas la casse off-market
    property_type: 'Maison',
    listing_kind: 'sale',
  })

  send('phone_click', {
    // @ts-expect-error un phone_click ne prend pas un jeton e-mail
    cta: 'footer_email',
    page_type: 'home',
  })

  send('email_click', {
    // @ts-expect-error un email_click ne prend pas un jeton téléphone
    cta: 'nav_phone',
    page_type: 'legal',
  })

  // @ts-expect-error un axe autre que city exige son compagnon
  send('property_filter', { filter_axis: 'sort' })

  send('property_filter', {
    filter_axis: 'sort',
    // @ts-expect-error le compagnon doit correspondre à l'axe
    view: 'map',
  })

  send('property_filter', {
    filter_axis: 'city',
    // @ts-expect-error un filtre city ne prend pas un autre compagnon
    sort: 'recent',
  })

  send('no_search_results', {
    listing_kind: 'sale',
    // @ts-expect-error results_count vaut exactement 0
    results_count: 1,
  })

  send('contact_submit', {
    // @ts-expect-error contact_submit n'accepte que form = contact
    form: 'bien',
  })

  send('estimate_submit', {
    form: 'estimation',
    // @ts-expect-error l'estimation n'accepte pas un type hors maison, appartement, terrain
    property_type: 'commerce',
    surface: 80,
  })

  send('offmarket_submit', {
    form: 'offmarket',
    // @ts-expect-error le secteur doit appartenir à la liste fermée
    sector: 'Paris',
  })

  send('form_error', {
    form: 'contact',
    // @ts-expect-error le code d'erreur doit appartenir à la liste fermée
    error_code: 'timeout',
  })

  send('generate_lead', {
    form: 'contact',
    // @ts-expect-error generate_lead n'a pas de référence
    property_ref: '6973600',
  })
}

type Closed<E extends AnalyticsEventName, Extra extends string> = Extra extends keyof EventParams<E> ? never : true

// page_view n'a aucune clé. Le type résultant est {}, donc une clé libre
// ne produit pas d'erreur d'excès : le rejet reste celui de validateEvent.
const pageClosed: Closed<'page_view', 'city'> = true
const leadClosed: Closed<'generate_lead', 'property_ref'> = true

void accepts, pageClosed, leadClosed
