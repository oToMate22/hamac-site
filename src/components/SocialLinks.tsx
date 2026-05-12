import { HAMAC_SOCIAL_LINKS } from '../data/socialLinks'
import { SocialBrandIcon } from './SocialBrandIcon'

type SocialLinksProps = {
  className?: string
  /** Sur fond clair (contact) ou fond marine (footer) */
  variant?: 'light' | 'dark'
}

export function SocialLinks({ className = '', variant = 'light' }: SocialLinksProps) {
  const rootClass = ['social-links', variant === 'dark' ? 'social-links--dark' : '', className].filter(Boolean).join(' ')

  return (
    <nav className={rootClass} aria-label="Réseaux sociaux Hamac Investissements & Patrimoine">
      <ul className="social-links__list">
        {HAMAC_SOCIAL_LINKS.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${item.label} — ouvre dans un nouvel onglet`}
            >
              <SocialBrandIcon id={item.id} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
