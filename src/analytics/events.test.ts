import { validateEvent } from './events'
import { reserveLead, resetLeadReservations } from './lead-dedup'

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const phone = validateEvent('phone_click', { cta: 'nav_phone', page_type: 'home' })
check(phone.ok, 'phone_click')

const extra = validateEvent('phone_click', { cta: 'nav_phone', page_type: 'home', email: 'a@b.fr' })
check(!extra.ok && extra.reason === 'unexpected_key', 'clé inconnue refusée')

const lead = validateEvent('generate_lead', { form: 'contact' })
check(lead.ok, 'generate_lead')

const leadMissing = validateEvent('generate_lead', {})
check(!leadMissing.ok, 'generate_lead sans formulaire')

const emptySearch = validateEvent('no_search_results', { listing_kind: 'sale', results_count: 0 })
check(emptySearch.ok, 'recherche vide')

const fakeEmpty = validateEvent('no_search_results', { listing_kind: 'sale', results_count: 3 })
check(!fakeEmpty.ok, 'un compte non nul ne peut pas être no_search_results')

const view = validateEvent('property_view', {
  property_ref: 'maison-ecully',
  property_type: 'maison',
  listing_kind: 'sale',
  city: 'Écully',
})
check(view.ok, 'property_view')

const personalRef = validateEvent('property_view', {
  property_ref: 'client@hamacpatrimoine.com',
  property_type: 'maison',
  listing_kind: 'sale',
})
check(!personalRef.ok, 'une référence personnelle est refusée')

resetLeadReservations()
check(reserveLead('contact', 1_000), 'premier lead')
check(!reserveLead('contact', 1_200), 'lead doublé')
check(reserveLead('estimation', 1_200), 'autre formulaire')
check(reserveLead('contact', 3_000), 'lead suivant')

console.log('hamac analytics events: ok')
