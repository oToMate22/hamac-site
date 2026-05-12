export type SocialLinkItem = {
  id: 'instagram' | 'facebook' | 'linkedin'
  href: string
  /** Phrase pour aria-label */
  label: string
}

export const HAMAC_SOCIAL_LINKS: SocialLinkItem[] = [
  {
    id: 'instagram',
    href: 'https://www.instagram.com/hamacpatrimoine/',
    label: 'Hamac sur Instagram',
  },
  {
    id: 'facebook',
    href: 'https://www.facebook.com/HamacInvestissementsPatrimoine/',
    label: 'Hamac sur Facebook',
  },
  {
    id: 'linkedin',
    href: 'https://www.linkedin.com/company/hamac-investissements-patrimoine/',
    label: 'Hamac sur LinkedIn',
  },
]
