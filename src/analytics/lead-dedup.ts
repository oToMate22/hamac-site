/** Une même demande ne produit qu'un generate_lead, même si le succès est signalé deux fois de suite. */
const WINDOW_MS = 1500
const recent = new Map<string, number>()

export function reserveLead(form: string, now: number): boolean {
  const previous = recent.get(form)
  if (previous !== undefined && now - previous < WINDOW_MS) return false
  recent.set(form, now)
  return true
}

export function resetLeadReservations(): void {
  recent.clear()
}
