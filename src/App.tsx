import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, NavLink, Outlet, Route, Routes, useLocation, useSearchParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SocialLinks } from './components/SocialLinks'
import { AgencyPage } from './pages/AgencyPage'
import { BlogPage, BlogPostPage } from './pages/BlogPage'
import { ContactPage } from './pages/ContactPage'
import { EstimationPage } from './pages/EstimationPage'
import { InvestPage } from './pages/InvestPage'
import { FeesPage, LegalPage, PrivacyPage } from './pages/LegalPage'
import { LouerPage } from './pages/LouerPage'
import { HomePage } from './pages/HomePage'
import { NeighborhoodPage } from './pages/NeighborhoodPage'
import { OffMarketPage } from './pages/OffMarketPage'
import { PropertyDetailPage } from './pages/PropertyDetailPage'
import { PropertyListingPage } from './pages/PropertyListingPage'
import { QuartiersPage } from './pages/QuartiersPage'
import { SellingPage } from './pages/SellingPage'

type AppProps = {
  homeMainHtml: string
}

type NavItem = { label: string; to: string }

const SELL_MENU: NavItem[] = [
  { label: "Les etapes d'une vente", to: '/vendre' },
  { label: 'Acces off-market', to: '/off-market' },
]

const QUARTIERS_MENU: NavItem[] = [
  { label: 'Sainte-Foy-lès-Lyon', to: '/quartiers/sainte-foy-les-lyon' },
  { label: 'Tassin-la-Demi-Lune', to: '/quartiers/tassin-la-demi-lune' },
  { label: 'Écully', to: '/quartiers/ecully' },
  { label: 'Francheville', to: '/quartiers/francheville' },
  { label: 'Craponne', to: '/quartiers/craponne' },
  { label: 'Oullins', to: '/quartiers/oullins' },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])
  return null
}

function ListingRoutePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  return <PropertyListingPage searchParams={searchParams} setSearchParams={setSearchParams} />
}

function RentalListingRoutePage() {
  return <LouerPage />
}

function NavDropdown({
  label,
  to,
  items,
  splitAfterFirst = false,
}: {
  label: string
  to: string
  items: NavItem[]
  splitAfterFirst?: boolean
}) {
  const { pathname } = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const openTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)

  const clearTimers = () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
  }

  const handleMouseEnter = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    openTimerRef.current = window.setTimeout(() => setIsOpen(true), 200)
  }

  const handleMouseLeave = () => {
    if (openTimerRef.current) window.clearTimeout(openTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 150)
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  useEffect(() => {
    clearTimers()
    setIsOpen(false)
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
  }, [pathname])

  return (
    <div
      className={`nav-item nav-item--has-dropdown ${isOpen ? 'is-open' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavLink
        className="nav-link"
        to={to}
        onClick={(event) => {
          clearTimers()
          setIsOpen(false)
          event.currentTarget.blur()
        }}
      >
        {label}
      </NavLink>
      <span className="nav-dropdown__bridge" aria-hidden="true" />
      <div className="nav-dropdown" role="menu" aria-label={label}>
        {items.map((item, idx) => (
          <div key={item.to}>
            {splitAfterFirst && idx === 1 ? <div className="nav-dropdown__sep" /> : null}
            <NavLink
              className="nav-dropdown__item"
              to={item.to}
              onClick={(event) => {
                clearTimers()
                setIsOpen(false)
                event.currentTarget.blur()
              }}
            >
              {item.label}
            </NavLink>
          </div>
        ))}
      </div>
    </div>
  )
}

function SiteLayout() {
  const { pathname } = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSellOpen, setMobileSellOpen] = useState(false)
  const [mobileQuartiersOpen, setMobileQuartiersOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const isHeaderHoveredRef = useRef(false)
  const hideTimeoutRef = useRef<number | null>(null)
  const lastScrollYRef = useRef(0)
  const lastScrollAtRef = useRef(0)

  const closeAllMobileGroups = () => {
    setMobileSellOpen(false)
    setMobileQuartiersOpen(false)
  }

  const isAutoHidePage = pathname === '/acheter' || pathname === '/louer'

  useEffect(() => {
    const clearHideTimeout = () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current)
        hideTimeoutRef.current = null
      }
    }

    const scheduleHide = () => {
      clearHideTimeout()
      if (!isAutoHidePage || isHeaderHoveredRef.current) return
      hideTimeoutRef.current = window.setTimeout(() => {
        if (isHeaderHoveredRef.current) return
        setHeaderVisible(false)
      }, 900)
    }

    const onScroll = () => {
      const current = window.scrollY
      setScrolled(current > 24)

      const hasMoved = current !== lastScrollYRef.current
      if (isAutoHidePage && hasMoved) {
        setHeaderVisible(true)
        lastScrollAtRef.current = Date.now()
        if (current > 0) scheduleHide()
        else clearHideTimeout()
      }

      lastScrollYRef.current = current
    }

    lastScrollYRef.current = window.scrollY
    lastScrollAtRef.current = Date.now()
    setScrolled(false)
    setHeaderVisible(!isAutoHidePage || window.scrollY <= 0)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearHideTimeout()
    }
  }, [isAutoHidePage])

  const lightPages = ['/agence', '/vendre', '/estimation', '/contact', '/acheter', '/louer', '/quartiers', '/off-market', '/investir']
  const transparentHeaderRoutes = pathname === '/'
    || pathname === '/agence'
    || pathname === '/vendre'
    || pathname === '/off-market'
    || pathname === '/investir'
    || pathname.startsWith('/quartiers/')
  const isLightPage =
    lightPages.some((entry) => pathname === entry || pathname.startsWith(`${entry}/`))
    && !transparentHeaderRoutes
  const logoSrc = '/images/Logo/logo-hamac-dark.png?v=20260507-6'
  const footerMergedWithCta = pathname === '/' || pathname === '/quartiers'

  return (
    <>
      <a className="skip-link" href="#contenu-principal">Aller au contenu</a>
      <header
        className={`site-header ${scrolled ? 'is-scrolled' : ''} ${transparentHeaderRoutes ? '' : 'is-solid-on-top'} ${isLightPage ? 'navbar--light' : ''} ${isAutoHidePage && !headerVisible ? 'is-auto-hide-hidden' : ''}`}
        onMouseEnter={() => {
          if (isAutoHidePage) {
            if (hideTimeoutRef.current) {
              window.clearTimeout(hideTimeoutRef.current)
              hideTimeoutRef.current = null
            }
            setHeaderVisible(true)
            isHeaderHoveredRef.current = true
          }
        }}
        onMouseLeave={() => {
          if (isAutoHidePage) {
            isHeaderHoveredRef.current = false
            if (hideTimeoutRef.current) {
              window.clearTimeout(hideTimeoutRef.current)
            }
            if (window.scrollY > 0) {
              hideTimeoutRef.current = window.setTimeout(() => {
                setHeaderVisible(false)
              }, 900)
            }
          }
        }}
      >
        <div className="site-header__inner">
          <Link className="logo" to="/">
            <img className="logo__image" src={logoSrc} alt="Hamac Investissements & Patrimoine" loading="eager" />
          </Link>
          <nav className="nav nav--router" aria-label="Navigation principale">
            <NavLink className="nav-link" to="/acheter">Acheter</NavLink>
            <NavLink className="nav-link" to="/louer">Louer</NavLink>
            <NavDropdown label="Vendre" to="/vendre" items={SELL_MENU} />
            <NavLink className="nav-link" to="/estimation">Estimation</NavLink>
            <NavDropdown label="Communes" to="/quartiers" items={QUARTIERS_MENU} />
            <NavLink className="nav-link" to="/agence">L'agence</NavLink>
            <NavLink className="nav-link" to="/contact">Contact</NavLink>
          </nav>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={mobileOpen}
            aria-controls="nav-mobile"
            aria-label="Ouvrir le menu"
            onClick={() =>
              setMobileOpen((value) => {
                const next = !value
                if (next) {
                  closeAllMobileGroups()
                }
                return next
              })
            }
          >
            <span></span><span></span><span></span>
          </button>
        </div>
        <div id="nav-mobile" className="nav-mobile nav-mobile--router" hidden={!mobileOpen}>
          <NavLink className="nav-mobile__primary-link" to="/acheter" onClick={() => setMobileOpen(false)}>Acheter</NavLink>
          <NavLink className="nav-mobile__primary-link" to="/louer" onClick={() => setMobileOpen(false)}>Louer</NavLink>

          <button
            type="button"
            className={`nav-mobile__group ${mobileSellOpen ? 'is-open' : ''}`}
            aria-expanded={mobileSellOpen}
            onClick={() => {
              const next = !mobileSellOpen
              closeAllMobileGroups()
              setMobileSellOpen(next)
            }}
          >
            <span>Vendre</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div hidden={!mobileSellOpen} className="nav-mobile__items">
            {SELL_MENU.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>
            ))}
          </div>

          <NavLink className="nav-mobile__primary-link" to="/estimation" onClick={() => setMobileOpen(false)}>Estimation</NavLink>

          <button
            type="button"
            className={`nav-mobile__group ${mobileQuartiersOpen ? 'is-open' : ''}`}
            aria-expanded={mobileQuartiersOpen}
            onClick={() => {
              const next = !mobileQuartiersOpen
              closeAllMobileGroups()
              setMobileQuartiersOpen(next)
            }}
          >
            <span>Communes</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div hidden={!mobileQuartiersOpen} className="nav-mobile__items">
            {QUARTIERS_MENU.map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}>{item.label}</NavLink>
            ))}
          </div>

          <NavLink className="nav-mobile__primary-link" to="/agence" onClick={() => setMobileOpen(false)}>L'agence</NavLink>

          <NavLink className="nav-mobile__primary-link" to="/contact" onClick={() => setMobileOpen(false)}>Contact</NavLink>
        </div>
      </header>

      <div id="contenu-principal">
        <Outlet />
      </div>

      <footer className={`site-footer${footerMergedWithCta ? ' site-footer--merged-top' : ''}`}>
        <div className="wave wave--footer-top" aria-hidden="true">
          <svg viewBox="0 0 1440 56" preserveAspectRatio="none" focusable="false">
            <path className="wave__path wave__path--footer" d="M0,44 C240,30 520,50 820,38 C1080,28 1270,46 1440,34 L1440,56 L0,56 Z" />
          </svg>
        </div>
        <div className="container site-footer__grid">
          <div className="site-footer__brand">
            <div className="site-footer__brand-card">
              <div className="site-footer__brand-logo">
                <p className="logo logo--footer">
                  <img
                    className="logo__image logo__image--footer"
                    src="/images/Logo/logo-hamac.png"
                    alt="Hamac Investissements & Patrimoine"
                    loading="lazy"
                  />
                </p>
              </div>
              <p className="site-footer__tagline">Agence indépendante, locale et non généraliste</p>
              <div className="site-footer__brand-foot">
                <p className="site-footer__social-label">Suivez-nous</p>
                <SocialLinks className="site-footer__socials" variant="dark" />
              </div>
            </div>
          </div>
          <div>
            <h3 className="site-footer__heading">Contact</h3>
            <address className="site-footer__address">
              12 avenue de la Liberation<br />
              69110 Sainte-Foy-les-Lyon<br />
              <a href="tel:+33400000000">04 00 00 00 00</a><br />
              <a href="mailto:contact@hamac-immo.fr">contact@hamac-immo.fr</a>
            </address>
          </div>
          <div>
            <h3 className="site-footer__heading">Liens rapides</h3>
            <ul className="site-footer__links">
              <li><Link to="/acheter">Nos biens</Link></li>
              <li><Link to="/agence">L'agence</Link></li>
              <li><Link to="/estimation">Estimation</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">Informations</h3>
            <ul className="site-footer__links">
              <li><Link to="/mentions-legales">Mentions legales</Link></li>
              <li><Link to="/honoraires">Honoraires</Link></li>
              <li><Link to="/confidentialite">Confidentialite</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="site-footer__heading">Journal</h3>
            <ul className="site-footer__links">
              <li><Link to="/blog">Tous les articles</Link></li>
              <li><Link to="/blog?category=marche-immobilier">Marche immobilier</Link></li>
              <li><Link to="/blog?category=guides-pratiques">Guides pratiques</Link></li>
              <li><Link to="/blog?category=vie-locale">Vie locale</Link></li>
            </ul>
          </div>
        </div>
        <div className="site-footer__bottom">
          <div className="container site-footer__bottom-inner">
            <p>© {new Date().getFullYear()} Hamac Investissements & Patrimoine. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </>
  )
}

export function App({ homeMainHtml }: AppProps) {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<HomePage homeMainHtml={homeMainHtml} />} />
          <Route path="/acheter" element={<ListingRoutePage />} />
          <Route path="/louer" element={<RentalListingRoutePage />} />
          <Route path="/acheter/:slug" element={<PropertyDetailPage />} />
          <Route path="/louer/:slug" element={<PropertyDetailPage />} />
          <Route path="/vendre" element={<SellingPage />} />
          <Route path="/estimation" element={<EstimationPage />} />
          <Route path="/off-market" element={<OffMarketPage />} />
          <Route path="/quartiers" element={<QuartiersPage />} />
          <Route path="/quartiers/:slug" element={<NeighborhoodPage />} />
          <Route path="/agence" element={<AgencyPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/investir" element={<InvestPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/mentions-legales" element={<LegalPage />} />
          <Route path="/honoraires" element={<FeesPage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
