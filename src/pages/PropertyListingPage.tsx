import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import * as Slider from '@radix-ui/react-slider'
import { Check, ChevronDown, MapPin, Maximize2, Minimize2, Search, X } from 'lucide-react'
import { Command } from 'cmdk'
import { PropertyCard } from '../components/PropertyCard'
import { type Amenity, type Property } from '../data/properties'
import { SearchBar } from '../search/SearchBar'
import { applyQuartierParamToSearch } from '../utils/catalogSearch'
import { usePageMeta } from '../utils/seo'
import { getProperties, getRentalProperties, type FeaturedProperty } from '../services/apimo'
import { type PropertySort } from '../hooks/useProperties'
const PropertyMap = lazy(() => import('../components/PropertyMap').then((mod) => ({ default: mod.PropertyMap })))

type PropertyListingPageProps = {
  searchParams: URLSearchParams
  setSearchParams: (value: URLSearchParams, options?: { replace?: boolean }) => void
  mode?: 'sale' | 'rent'
}

function FilterSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
}) {
  return (
    <label className="catalog-filter__group">
      <span className="catalog-filter__label">{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="catalog-filter__trigger" aria-label={label}>
          <Select.Value />
          <Select.Icon>
            <ChevronDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="catalog-filter__content" position="popper" sideOffset={8}>
            <Select.Viewport className="catalog-filter__viewport">
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="catalog-filter__item">
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  )
}

export function PropertyListingPage({ searchParams, setSearchParams, mode = 'sale' }: PropertyListingPageProps) {
  usePageMeta({
    title:
      mode === 'rent'
        ? 'Biens à louer — Hamac Investissements & Patrimoine'
        : 'Biens à vendre — Hamac Investissements & Patrimoine',
    description:
      mode === 'rent'
        ? "Explorez nos biens à louer dans l'Ouest Lyonnais : appartements, maisons et opportunités sélectionnés par Hamac."
        : "Explorez nos biens disponibles dans l'Ouest Lyonnais : maisons, appartements et terrains sélectionnés par Hamac.",
  })

  const [visibleCount, setVisibleCount] = useState(32)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [mobileMapOpen, setMobileMapOpen] = useState(false)
  const [mapExpanded, setMapExpanded] = useState(false)
  const [hoveredPropertySlug, setHoveredPropertySlug] = useState<string | null>(null)
  const [cityFilterOpen, setCityFilterOpen] = useState(false)
  const [cityFilterQuery, setCityFilterQuery] = useState('')
  const budgetSliderCap = mode === 'rent' ? 8000 : 1_950_000
  const budgetSliderStep = mode === 'rent' ? 100 : 50_000
  const rentBudgetSuffix = mode === 'rent' ? ' / mois' : ''
  const defaultBudgetMin = mode === 'rent' ? 0 : 650_000
  const defaultBudgetMax = mode === 'rent' ? 3000 : 1_950_000

  // Mémorise les filtres par mode pour une navigation fluide (retour fiche → catalogue).
  const filtersStorageKey = `hamac:catalog-filters:${mode}`
  const restoredFiltersRef = useRef(false)

  const persistFilters = (params: URLSearchParams) => {
    try {
      sessionStorage.setItem(filtersStorageKey, params.toString())
    } catch {
      // sessionStorage indisponible (mode privé strict) : on ignore.
    }
  }

  // Au montage : si on arrive sans aucun filtre dans l'URL, on restaure la
  // dernière recherche de ce mode (sale/rent) mémorisée pendant la session.
  useEffect(() => {
    if (restoredFiltersRef.current) return
    restoredFiltersRef.current = true
    if (Array.from(searchParams.keys()).length > 0) return
    try {
      const saved = sessionStorage.getItem(filtersStorageKey)
      if (saved) setSearchParams(new URLSearchParams(saved), { replace: true })
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const type = searchParams.get('type') ?? 'all'
  const city = searchParams.get('city') ?? 'all'
  const budgetParam = searchParams.get('budget')
  const budgetMin = searchParams.get('budgetMin') ?? String(defaultBudgetMin)
  const surface = searchParams.get('surface') ?? 'all'
  const rooms = searchParams.get('rooms') ?? 'all'
  const q = searchParams.get('q') ?? ''
  const sort = (searchParams.get('sort') as PropertySort) ?? 'recent'
  const amenities = (searchParams.get('amenities')?.split(',').filter(Boolean) ?? []) as Amenity[]

  /** Plafond appliqué au filtre : absent de l’URL = défaut vente/location ; `all` = aucun plafond */
  const budgetMaxForFilter = (() => {
    if (budgetParam === 'all') return undefined
    if (budgetParam == null || budgetParam === '') return defaultBudgetMax
    const n = Number(budgetParam)
    if (!Number.isFinite(n)) return defaultBudgetMax
    return Math.min(Math.max(0, n), budgetSliderCap)
  })()

  const budgetMinValue = (() => {
    if (budgetMin === 'all') return 0
    const n = Number(budgetMin)
    if (!Number.isFinite(n)) return 0
    return Math.min(Math.max(0, n), budgetSliderCap)
  })()

  /** Position du curseur droit : tout à droite = sans plafond (`all`) */
  const budgetMaxThumb = budgetParam === 'all' ? budgetSliderCap : (budgetMaxForFilter ?? defaultBudgetMax)

  /** Valeur affichée dans la barre de recherche (Select budget max) */
  const budgetForSearchBar = budgetParam === 'all' ? 'all' : budgetParam == null || budgetParam === '' ? String(defaultBudgetMax) : budgetParam

  const surfaceValue = surface !== 'all' ? Number(surface) : 0

  const [apiProperties, setApiProperties] = useState<Property[] | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’-]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  const toTokens = (value: string) => normalize(value).split(' ').filter(Boolean)

  const matchesAllTokens = (source: string, query: string) => {
    const sourceTokens = toTokens(source)
    const queryTokens = toTokens(query)
    if (!queryTokens.length) return true
    return queryTokens.every((token) => sourceTokens.some((sourceToken) => sourceToken.includes(token)))
  }

  const mapFeaturedToProperty = (p: FeaturedProperty): Property => {
    const fallbackImage = '/images/Biens/maison-homepage.jpg'
    return {
      slug: p.slug,
      title: p.title,
      city: p.city,
      type: p.type,
      price: p.price,
      surface: p.surface,
      rooms: p.rooms,
      bedrooms: p.bedrooms,
      badge: p.badge ?? 'Nouveau',
      reference: p.slug,
      description: '',
      heating: '',
      exposure: '',
      year: 0,
      dpe: '',
      lat: p.lat ?? Number.NaN,
      lng: p.lng ?? Number.NaN,
      amenities: p.amenities,
      images: p.images.length ? p.images : [fallbackImage],
    }
  }

  const reloadProperties = async () => {
    setApiError(null)
    setApiProperties(null) // loading
    try {
      const featured = mode === 'rent'
        ? await getRentalProperties()
        : (await getProperties()).filter((property) => property.agreementType !== 2)
      const mapped = featured.map(mapFeaturedToProperty)
      setApiProperties(mapped)
    } catch (err) {
      setApiError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void reloadProperties()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const properties = (() => {
    if (!apiProperties) return []

    const filters = {
      type: type.toLowerCase(),
      city,
      q,
      budgetMin: budgetMinValue > 0 ? budgetMinValue : undefined,
      budgetMax: budgetMaxForFilter,
      surfaceMin: surface !== 'all' ? Number(surface) : undefined,
      bedroomsMin: rooms !== 'all' ? Number(rooms) : undefined,
      amenities,
    }

    const filtered = apiProperties.filter((property) => {
      if (filters.type && filters.type !== 'all' && property.type.toLowerCase() !== filters.type) return false
      if (filters.city && filters.city !== 'all' && !matchesAllTokens(property.city, filters.city)) return false
      if (filters.budgetMin !== undefined && property.price < filters.budgetMin) return false
      if (filters.budgetMax !== undefined && property.price > filters.budgetMax) return false
      if (filters.surfaceMin && property.surface < filters.surfaceMin) return false
      if (filters.bedroomsMin && property.bedrooms < filters.bedroomsMin) return false
      if (filters.q && !matchesAllTokens(property.city, filters.q)) return false
      if (filters.amenities?.length && !filters.amenities.every((entry) => property.amenities.includes(entry))) return false
      return true
    })

    const sorted = [...filtered]
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
    if (sort === 'surface') sorted.sort((a, b) => b.surface - a.surface)
    if (sort === 'recent') sorted.sort((a, b) => (a.reference < b.reference ? 1 : -1))

    return sorted
  })()

  const availableCities = (() => {
    if (!apiProperties) return []
    return Array.from(new Set(apiProperties.map((property) => property.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'))
  })()

  const sidebarCityMatches = (() => {
    const query = normalize(cityFilterQuery)
    return availableCities
      .map((entry) => {
        const normalizedCity = normalize(entry)
        if (!query) return { entry, score: 1 }
        if (!matchesAllTokens(normalizedCity, query)) return { entry, score: 0 }

        const queryTokens = toTokens(query)
        const cityTokens = toTokens(normalizedCity)
        const startsWord = queryTokens.every((token) =>
          cityTokens.some((word) => word.startsWith(token)),
        )
        return { entry, score: startsWord ? 2 : 1 }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.localeCompare(b.entry, 'fr'))
      .map((item) => item.entry)
  })()

  useEffect(() => {
    const quartierSlug = searchParams.get('quartier')
    if (!quartierSlug) return

    const next = applyQuartierParamToSearch(searchParams, quartierSlug, mode)
    if (!next) return

    setSearchParams(next, { replace: true })
  }, [mode, searchParams, setSearchParams])

  useEffect(() => setVisibleCount(32), [type, city, budgetParam, budgetMin, surface, rooms, sort, q])
  useEffect(() => {
    setCityFilterQuery(city === 'all' ? '' : city)
  }, [city])
  useEffect(() => {
    if (!mobileMapOpen) return
    const timeoutId = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 150)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [mobileMapOpen])

  const isLoading = apiProperties === null && apiError === null
  const propertiesForMap = !isLoading && !apiError ? properties : []

  useEffect(() => {
    if (!mapExpanded) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMapExpanded(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mapExpanded])

  const renderCatalogMap = (expanded: boolean, visible: boolean) => {
    if (apiError || isLoading) {
      return <div className="catalog-map-loading">Chargement de la carte...</div>
    }
    return (
      <Suspense fallback={<div className="catalog-map-loading">Chargement de la carte...</div>}>
        <PropertyMap
          properties={propertiesForMap}
          hoveredSlug={hoveredPropertySlug}
          onHoverChange={setHoveredPropertySlug}
          isVisible={visible}
          isExpanded={expanded}
        />
      </Suspense>
    )
  }

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    persistFilters(next)
    setSearchParams(next)
  }

  const updateParams = (entries: Array<{ key: string; value: string }>) => {
    const next = new URLSearchParams(searchParams)
    entries.forEach(({ key, value }) => {
      if (!value || value === 'all') next.delete(key)
      else next.set(key, value)
    })
    persistFilters(next)
    setSearchParams(next)
  }

  const toggleAmenity = (amenity: Amenity) => {
    const nextSet = new Set(amenities)
    if (nextSet.has(amenity)) nextSet.delete(amenity)
    else nextSet.add(amenity)
    const next = new URLSearchParams(searchParams)
    if (nextSet.size) next.set('amenities', Array.from(nextSet).join(','))
    else next.delete('amenities')
    persistFilters(next)
    setSearchParams(next)
  }

  const formatEuro = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} €`

  return (
    <main className="catalog-page">
      <section className="catalog-hero">
        <div className="container">
          <h1 className="section-title">Nos biens dans l&apos;Ouest Lyonnais</h1>
          <p className="catalog-hero__intro">
            {mode === 'rent'
              ? 'Des biens en location choisis pour leur emplacement, leur confort et leur qualite de vie.'
              : 'Des maisons et appartements choisis pour leur adresse, leur potentiel et leur qualite de vie.'}
          </p>
          <SearchBar
            action={mode === 'rent' ? '/louer' : '/acheter'}
            compact
            cityOptions={availableCities}
            initialValues={{ type, budget: budgetForSearchBar, city: q }}
            onSearch={(filters) => {
              updateParams([
                { key: 'type', value: filters.type },
                { key: 'budget', value: filters.budget },
                { key: 'budgetMin', value: budgetMin },
                { key: 'q', value: filters.city },
              ])
            }}
          />
        </div>
      </section>
      <section className="catalog-body section section--cream">
        <div className="container catalog-layout">
          <button className="catalog-filter-toggle" type="button" onClick={() => setMobileFiltersOpen((value) => !value)}>
            Filtres avances
          </button>
          <aside className={`catalog-sidebar ${mobileFiltersOpen ? 'is-open' : ''}`}>
            <div className="catalog-filter-card">
              <FilterSelect label="Type" value={type} onValueChange={(value) => updateParam('type', value)} options={[
                { value: 'all', label: 'Tous' },
                { value: 'appartement', label: 'Appartement' },
                { value: 'maison', label: 'Maison' },
                { value: 'terrain', label: 'Terrain' },
                { value: 'commerce', label: 'Commerce' },
                { value: 'bureau', label: 'Bureau' },
                { value: 'garage', label: 'Garage / Parking' },
                { value: 'immeuble', label: 'Immeuble' },
              ]} />
              <label className="catalog-filter__group">
                <span className="catalog-filter__label">Ville</span>
                <Popover.Root open={cityFilterOpen} onOpenChange={setCityFilterOpen}>
                  <Popover.Trigger asChild>
                    <button type="button" className="catalog-filter__city-trigger" aria-label="Filtrer par ville">
                      <Search size={14} />
                      <span>{city === 'all' ? 'Toutes les villes' : city}</span>
                      <ChevronDown size={14} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="catalog-filter__city-popover" sideOffset={8} align="start">
                      <Command className="catalog-filter__city-command">
                        <div className="catalog-filter__city-input-wrap">
                          <Search size={14} />
                          <Command.Input
                            className="catalog-filter__city-input"
                            placeholder="Rechercher une ville"
                            value={cityFilterQuery}
                            onValueChange={setCityFilterQuery}
                          />
                          {city !== 'all' ? (
                            <button
                              type="button"
                              className="catalog-filter__city-clear"
                              aria-label="Réinitialiser la ville"
                              onClick={() => {
                                updateParam('city', 'all')
                                setCityFilterQuery('')
                                setCityFilterOpen(false)
                              }}
                            >
                              <X size={14} />
                            </button>
                          ) : null}
                        </div>
                        <Command.List className="catalog-filter__city-list">
                          <Command.Item
                            value="Toutes les villes"
                            className="catalog-filter__city-item"
                            onSelect={() => {
                              updateParam('city', 'all')
                              setCityFilterQuery('')
                              setCityFilterOpen(false)
                            }}
                          >
                            <span>Toutes les villes</span>
                            {city === 'all' ? <Check size={14} /> : null}
                          </Command.Item>
                          <Command.Empty className="catalog-filter__city-empty">Aucune ville trouvée.</Command.Empty>
                          {sidebarCityMatches.map((entry) => (
                            <Command.Item
                              key={entry}
                              value={entry}
                              className="catalog-filter__city-item"
                              onSelect={() => {
                                updateParam('city', entry)
                                setCityFilterQuery(entry)
                                setCityFilterOpen(false)
                              }}
                            >
                              <span>{entry}</span>
                              {city === entry ? <Check size={14} /> : null}
                            </Command.Item>
                          ))}
                        </Command.List>
                      </Command>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </label>
              <label className="catalog-filter__group">
                <span className="catalog-filter__label">
                  {mode === 'rent' ? 'Loyer (min. — max.)' : 'Budget (min. — max.)'}
                </span>
                <p className="catalog-slider__value">
                  {budgetMinValue > 0
                    ? `de ${formatEuro(budgetMinValue)}${rentBudgetSuffix}`
                    : mode === 'rent'
                      ? 'Sans Plancher'
                      : 'Sans Minimum'}
                  {' — '}
                  {budgetParam === 'all' || (budgetMaxForFilter ?? defaultBudgetMax) >= budgetSliderCap
                    ? 'Sans Budget Max'
                    : `jusqu'à ${formatEuro(budgetMaxForFilter ?? defaultBudgetMax)}${rentBudgetSuffix}`}
                </p>
                <Slider.Root
                  className="catalog-slider"
                  min={0}
                  max={budgetSliderCap}
                  step={budgetSliderStep}
                  minStepsBetweenThumbs={1}
                  value={[budgetMinValue, budgetMaxThumb]}
                  onValueChange={(values) => {
                    const rawMin = values[0] ?? 0
                    const rawMax = values[1] ?? budgetSliderCap
                    let minV = Math.min(rawMin, rawMax)
                    let maxV = Math.max(rawMin, rawMax)
                    minV = Math.min(Math.max(0, minV), budgetSliderCap)
                    maxV = Math.min(Math.max(0, maxV), budgetSliderCap)
                    if (maxV < minV + budgetSliderStep) maxV = minV + budgetSliderStep
                    if (maxV > budgetSliderCap) maxV = budgetSliderCap
                    const minParam = minV <= 0 ? '0' : String(minV)
                    const maxAtCap = maxV >= budgetSliderCap - budgetSliderStep / 2
                    const maxParam = maxAtCap ? 'all' : String(maxV)
                    updateParams([
                      { key: 'budgetMin', value: minParam },
                      { key: 'budget', value: maxParam },
                    ])
                  }}
                  aria-label={mode === 'rent' ? 'Fourchette de loyer' : 'Fourchette de budget'}
                >
                  <Slider.Track className="catalog-slider__track">
                    <Slider.Range className="catalog-slider__range" />
                  </Slider.Track>
                  <Slider.Thumb className="catalog-slider__thumb" aria-label={mode === 'rent' ? 'Loyer minimum' : 'Budget minimum'} />
                  <Slider.Thumb className="catalog-slider__thumb" aria-label={mode === 'rent' ? 'Loyer maximum' : 'Budget maximum'} />
                </Slider.Root>
              </label>
              <label className="catalog-filter__group">
                <span className="catalog-filter__label">Surface min</span>
                <p className="catalog-slider__value">
                  {surfaceValue > 0 ? `à partir de ${surfaceValue} m²` : 'Toutes surfaces'}
                </p>
                <Slider.Root
                  className="catalog-slider"
                  min={0}
                  max={300}
                  step={10}
                  value={[surfaceValue]}
                  onValueChange={(values) => updateParam('surface', values[0] > 0 ? String(values[0]) : 'all')}
                  aria-label="Surface minimum"
                >
                  <Slider.Track className="catalog-slider__track">
                    <Slider.Range className="catalog-slider__range" />
                  </Slider.Track>
                  <Slider.Thumb className="catalog-slider__thumb" aria-label="Surface minimum" />
                </Slider.Root>
              </label>
              <FilterSelect label="Chambres min" value={rooms} onValueChange={(value) => updateParam('rooms', value)} options={[
                { value: 'all', label: 'Toutes' }, { value: '1', label: '1+' }, { value: '2', label: '2+' }, { value: '3', label: '3+' }, { value: '4', label: '4+' },
              ]} />
              <div className="catalog-filter__group">
                <span className="catalog-filter__label">Criteres</span>
                <div className="catalog-chips">
                  {(['jardin', 'piscine', 'terrasse', 'garage'] as Amenity[]).map((amenity) => (
                    <button key={amenity} type="button" className={`catalog-chip ${amenities.includes(amenity) ? 'is-active' : ''}`} onClick={() => toggleAmenity(amenity)}>{amenity}</button>
                  ))}
                </div>
              </div>
            </div>
            {!mapExpanded ? (
              <aside className="catalog-map-panel">
                <button
                  type="button"
                  className="catalog-map-expand"
                  aria-label="Agrandir la carte"
                  onClick={() => setMapExpanded(true)}
                >
                  <Maximize2 size={15} />
                </button>
                {renderCatalogMap(false, !mobileMapOpen)}
              </aside>
            ) : null}
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <p>{isLoading ? 'Chargement...' : apiError ? 'Erreur lors du chargement' : `${properties.length} biens trouves`}</p>
              <FilterSelect label="Trier" value={sort} onValueChange={(value) => updateParam('sort', value)} options={[
                { value: 'recent', label: 'Plus recents' }, { value: 'price-asc', label: 'Prix croissant' }, { value: 'price-desc', label: 'Prix decroissant' }, { value: 'surface', label: 'Surface' },
              ]} />
            </div>
            {apiError ? (
              <div className="catalog-grid">
                <div className="catalog-map-loading">
                  <div>
                    <p style={{ marginBottom: 12 }}>Impossible de charger les biens.</p>
                    <button type="button" className="btn btn--outline-light catalog-load-more" onClick={() => void reloadProperties()}>
                      Réessayer
                    </button>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="catalog-grid">
                <div className="catalog-map-loading">Chargement des biens...</div>
              </div>
            ) : (
              <div className="catalog-grid">
                {properties.slice(0, visibleCount).map((property, index) => (
                  <motion.div
                    key={property.slug}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: Math.min(index * 0.1, 0.4) }}
                  >
                    <PropertyCard
                      property={property}
                      light
                      highlighted={hoveredPropertySlug === property.slug}
                      onHoverChange={setHoveredPropertySlug}
                      priorityImage={index < 3}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <button
        type="button"
        className="catalog-map-toggle"
        aria-label="Voir les biens sur la carte"
        onClick={() => setMobileMapOpen(true)}
      >
        <MapPin size={16} />
        <span>Voir sur la carte</span>
      </button>
      {mobileMapOpen ? (
        <div className="catalog-map-overlay" role="dialog" aria-label="Carte des biens">
          <button type="button" className="catalog-map-overlay__close" onClick={() => setMobileMapOpen(false)}>
            Voir la liste
          </button>
          <div
            className="catalog-map-overlay__map"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {renderCatalogMap(true, mobileMapOpen)}
          </div>
        </div>
      ) : null}
      {mapExpanded
        ? createPortal(
            <div className="catalog-map-expanded-root" role="dialog" aria-modal="true" aria-label="Carte agrandie des biens">
              <button
                type="button"
                className="catalog-map-expanded-backdrop"
                aria-label="Fermer la carte agrandie"
                onClick={() => setMapExpanded(false)}
              />
              <aside
                className="catalog-map-panel is-expanded"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="catalog-map-expand"
                  aria-label="Reduire la carte"
                  onClick={() => setMapExpanded(false)}
                >
                  <Minimize2 size={15} />
                </button>
                {renderCatalogMap(true, true)}
              </aside>
            </div>,
            document.body,
          )
        : null}
    </main>
  )
}
