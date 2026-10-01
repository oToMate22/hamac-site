import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import * as Slider from '@radix-ui/react-slider'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Command } from 'cmdk'
import { PropertyCard } from '../components/PropertyCard'
import { type Amenity, type Property } from '../data/properties'
import { SearchBar } from '../search/SearchBar'
import {
  TYPE_OPTIONS,
  BUDGET_SLIDER_CAP,
  BUDGET_SLIDER_STEP,
  applyCatalogParam,
  formatEuroAmount,
  parseBudgetMax,
  parseBudgetMin,
  searchBarBudgetValue,
} from '../search/criteria'
import { applyQuartierParamToSearch } from '../utils/catalogSearch'
import { formatCommuneLabel, lookupCommuneCenter, matchesCitySearch, distanceKm } from '../utils/frenchCommunes'
import { useFrenchCommuneSearch } from '../hooks/useFrenchCommuneSearch'
import { usePageMeta } from '../utils/seo'
import { fetchCatalogProperties, CatalogLoadError, type FeaturedProperty } from '../services/apimo'
import { type PropertySort } from '../hooks/useProperties'
import type { MapViewState } from '../components/PropertyMap'
const PropertyMap = lazy(() => import('../components/PropertyMap').then((mod) => ({ default: mod.PropertyMap })))

const MAP_VIEW_STORAGE_KEY = 'hamac:catalog-map-view'

type SavedMapView = { center: [number, number]; zoom: number }

function readSavedMapView(): SavedMapView | null {
  try {
    const raw = sessionStorage.getItem(MAP_VIEW_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedMapView
    if (
      !Array.isArray(parsed.center) ||
      parsed.center.length !== 2 ||
      !Number.isFinite(parsed.center[0]) ||
      !Number.isFinite(parsed.center[1]) ||
      !Number.isFinite(parsed.zoom)
    ) {
      return null
    }
    return { center: [parsed.center[0], parsed.center[1]], zoom: parsed.zoom }
  } catch {
    return null
  }
}

function writeSavedMapView(view: SavedMapView) {
  try {
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, JSON.stringify(view))
  } catch {
    // sessionStorage indisponible
  }
}

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
  disabled = false,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onValueChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className={`catalog-filter__group${disabled ? ' is-disabled' : ''}`}>
      <span className="catalog-filter__label">{label}</span>
      <Select.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <Select.Trigger className="catalog-filter__trigger" aria-label={label} disabled={disabled}>
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
  const [hoveredPropertySlug, setHoveredPropertySlug] = useState<string | null>(null)
  const [cityFilterOpen, setCityFilterOpen] = useState(false)
  const [cityFilterQuery, setCityFilterQuery] = useState('')
  const [widePreview, setWidePreview] = useState(false)
  const [desktopMapLayout, setDesktopMapLayout] = useState(false)
  const [visibleZone, setVisibleZone] = useState<MapViewState['bounds'] | null>(null)
  const [fitAllSignal, setFitAllSignal] = useState(0)
  const [widenSignal, setWidenSignal] = useState(0)
  const openedAsMapViewRef = useRef(searchParams.get('view') === 'map')
  const mapResultsRef = useRef<HTMLDivElement>(null)
  const hoverOriginRef = useRef<'list' | 'map' | null>(null)
  const budgetSliderCap = BUDGET_SLIDER_CAP[mode]
  const budgetSliderStep = BUDGET_SLIDER_STEP[mode]
  const rentBudgetSuffix = mode === 'rent' ? ' / mois' : ''

  // Mémorise les filtres pour le lien « retour au catalogue » de la fiche.
  const filtersStorageKey = `hamac:catalog-filters:${mode}`

  const persistFilters = (params: URLSearchParams) => {
    try {
      sessionStorage.setItem(filtersStorageKey, params.toString())
    } catch {
      // sessionStorage indisponible (mode privé strict) : on ignore.
    }
  }

  useEffect(() => {
    persistFilters(searchParams)
  }, [filtersStorageKey, searchParams])

  useEffect(() => {
    const preview = window.matchMedia('(min-width: 768px)')
    const desktop = window.matchMedia('(min-width: 1024px)')
    const sync = () => {
      setWidePreview(preview.matches)
      setDesktopMapLayout(desktop.matches)
    }
    sync()
    preview.addEventListener('change', sync)
    desktop.addEventListener('change', sync)
    return () => {
      preview.removeEventListener('change', sync)
      desktop.removeEventListener('change', sync)
    }
  }, [])

  const type = searchParams.get('type') ?? 'all'
  const q = searchParams.get('q') ?? ''
  const locationQuery = q
  const budgetMaxForFilter = parseBudgetMax(searchParams)
  const budgetMinValue = Math.min(parseBudgetMin(searchParams), budgetSliderCap)
  const budgetMaxThumb = budgetMaxForFilter == null ? budgetSliderCap : Math.min(budgetMaxForFilter, budgetSliderCap)
  const budgetForSearchBar = searchBarBudgetValue(searchParams)
  const surface = searchParams.get('surface') ?? 'all'
  const rooms = searchParams.get('rooms') ?? 'all'
  const radiusParam = searchParams.get('radius')
  const radiusKm = (() => {
    const n = Number(radiusParam)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(n, 50)
  })()
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)
  const sort = (searchParams.get('sort') as PropertySort) ?? 'recent'
  const amenities = (searchParams.get('amenities')?.split(',').filter(Boolean) ?? []) as Amenity[]
  const isMapView = searchParams.get('view') === 'map'
  const listingPath = mode === 'rent' ? '/louer' : '/acheter'
  const listSearch = (() => {
    const next = new URLSearchParams(searchParams)
    next.delete('view')
    const qs = next.toString()
    return qs ? `?${qs}` : ''
  })()
  const mapSearch = (() => {
    const next = new URLSearchParams(searchParams)
    next.set('view', 'map')
    return `?${next.toString()}`
  })()
  const restoreMapFrame = isMapView && openedAsMapViewRef.current ? readSavedMapView() : null

  useEffect(() => {
    if (!isMapView) openedAsMapViewRef.current = false
  }, [isMapView])

  const surfaceValue = surface !== 'all' ? Number(surface) : 0

  const [apiProperties, setApiProperties] = useState<Property[] | null>(null)
  const [apiError, setApiError] = useState<'quota' | 'timeout' | 'network' | null>(null)
  const [cacheServedAt, setCacheServedAt] = useState<number | undefined>(undefined)
  const [catalogEpoch, setCatalogEpoch] = useState(0)

  useEffect(() => {
    if (!locationQuery || radiusKm <= 0) {
      setOrigin(null)
      return
    }
    const controller = new AbortController()
    void lookupCommuneCenter(locationQuery, controller.signal)
      .then((center) => {
        if (!controller.signal.aborted) setOrigin(center)
      })
      .catch(() => {
        if (!controller.signal.aborted) setOrigin(null)
      })
    return () => controller.abort()
  }, [locationQuery, radiusKm])

  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’-]/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()

  const toTokens = (value: string) => normalize(value).split(' ').filter(Boolean)

  const mapFeaturedToProperty = (p: FeaturedProperty): Property => {
    const fallbackImage = '/fr/images/Biens/maison-homepage.webp'
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

  const reloadProperties = () => setCatalogEpoch((value) => value + 1)

  useEffect(() => {
    const controller = new AbortController()
    setApiError(null)
    setCacheServedAt(undefined)
    setApiProperties(null)

    void (async () => {
      try {
        const result = await fetchCatalogProperties(mode, controller.signal)
        if (controller.signal.aborted) return
        setApiProperties(result.properties.map(mapFeaturedToProperty))
        setCacheServedAt(result.cacheServedAt)
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        const kind = err instanceof CatalogLoadError ? err.kind : 'network'
        setApiError(kind === 'timeout' ? 'timeout' : kind === 'quota' ? 'quota' : 'network')
      }
    })()

    return () => controller.abort()
  }, [mode, catalogEpoch])

  const properties = (() => {
    if (!apiProperties) return { listed: [] as Property[], catalog: [] as Property[] }

    const filters = {
      type: type.toLowerCase(),
      q,
      radiusKm,
      origin,
      budgetMin: budgetMinValue > 0 ? budgetMinValue : undefined,
      budgetMax: budgetMaxForFilter,
      surfaceMin: surface !== 'all' ? Number(surface) : undefined,
      bedroomsMin: rooms !== 'all' ? Number(rooms) : undefined,
      amenities,
    }

    const useRadius = Boolean(filters.radiusKm > 0 && filters.origin)
    const center = filters.origin

    const filtered = apiProperties.filter((property) => {
      if (filters.type && filters.type !== 'all' && property.type.toLowerCase() !== filters.type) return false
      if (useRadius && center) {
        if (!Number.isFinite(property.lat) || !Number.isFinite(property.lng)) return false
        if (distanceKm(center, { lat: property.lat, lng: property.lng }) > filters.radiusKm) return false
      } else if (filters.q && !matchesCitySearch(property.city, filters.q)) {
        return false
      }
      if (filters.budgetMin !== undefined && property.price < filters.budgetMin) return false
      if (filters.budgetMax !== undefined && property.price > filters.budgetMax) return false
      if (filters.surfaceMin && property.surface < filters.surfaceMin) return false
      if (filters.bedroomsMin && property.bedrooms < filters.bedroomsMin) return false
      if (filters.amenities?.length && !filters.amenities.every((entry) => property.amenities.includes(entry))) return false
      return true
    })

    const listed = filtered.filter((property) => {
      if (visibleZone && isMapView) {
        if (property.lat < visibleZone.south || property.lat > visibleZone.north) return false
        if (property.lng < visibleZone.west || property.lng > visibleZone.east) return false
      }
      return true
    })

    const applySort = (list: Property[]) => {
      const sorted = [...list]
      if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
      if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
      if (sort === 'surface') sorted.sort((a, b) => b.surface - a.surface)
      if (sort === 'recent') sorted.sort((a, b) => (a.reference < b.reference ? 1 : -1))
      return sorted
    }

    return { listed: applySort(listed), catalog: applySort(filtered) }
  })()
  const catalogProperties = properties.catalog
  const listedProperties = properties.listed

  const availableCities = (() => {
    if (!apiProperties) return []
    return Array.from(new Set(apiProperties.map((property) => property.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'))
  })()

  const { results: communeResults, loading: communeLoading } = useFrenchCommuneSearch(
    cityFilterQuery,
    cityFilterOpen,
  )

  const sidebarCityMatches = (() => {
    const query = normalize(cityFilterQuery)
    return availableCities
      .map((entry) => {
        const normalizedCity = normalize(entry)
        if (!query) return { entry, score: 1 }
        if (!matchesCitySearch(normalizedCity, query)) return { entry, score: 0 }

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

  const sidebarRemoteCommunes = communeResults.filter((entry) => {
    const name = normalize(entry.name)
    return !sidebarCityMatches.some((cityName) => normalize(cityName) === name)
  })

  useEffect(() => {
    const quartierSlug = searchParams.get('quartier')
    if (!quartierSlug) return

    const next = applyQuartierParamToSearch(searchParams, quartierSlug)
    if (!next) return

    setSearchParams(next, { replace: true })
  }, [mode, searchParams, setSearchParams])

  useEffect(() => setVisibleCount(32), [type, budgetMaxForFilter, budgetMinValue, surface, rooms, sort, q, radiusKm, visibleZone])
  useEffect(() => {
    setCityFilterQuery(q)
  }, [q])

  const isLoading = apiProperties === null && apiError === null
  const zoneActive = Boolean(visibleZone && isMapView)
  const propertiesForMap = !isLoading && !apiError ? catalogProperties : []

  const handleMapViewChange = useCallback((view: MapViewState) => {
    writeSavedMapView({ center: view.center, zoom: view.zoom })
    setVisibleZone(view.bounds)
  }, [])

  const handleHoverFromList = useCallback((slug: string | null) => {
    hoverOriginRef.current = 'list'
    setHoveredPropertySlug(slug)
  }, [])

  const handleHoverFromMap = useCallback((slug: string | null) => {
    hoverOriginRef.current = 'map'
    setHoveredPropertySlug(slug)
  }, [])

  useEffect(() => {
    if (!isMapView || !hoveredPropertySlug || hoverOriginRef.current !== 'map') return
    const root = mapResultsRef.current
    if (!root) return
    const target = root.querySelector(`[data-property-slug="${CSS.escape(hoveredPropertySlug)}"]`)
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [hoveredPropertySlug, isMapView])

  const renderCatalogMap = (expanded: boolean, visible: boolean) => {
    if (apiError || isLoading) {
      return <div className="catalog-map-loading">Chargement de la carte...</div>
    }
    return (
      <Suspense fallback={<div className="catalog-map-loading">Chargement de la carte...</div>}>
        <PropertyMap
          properties={propertiesForMap}
          hoveredSlug={hoveredPropertySlug}
          onHoverChange={expanded ? handleHoverFromMap : setHoveredPropertySlug}
          isVisible={visible}
          isExpanded={expanded}
          initialCenter={expanded ? restoreMapFrame?.center : undefined}
          initialZoom={expanded ? restoreMapFrame?.zoom : undefined}
          onViewChange={expanded ? handleMapViewChange : undefined}
          autoFit={!expanded}
          fitAllSignal={expanded ? fitAllSignal : 0}
          widenSignal={expanded ? widenSignal : 0}
          fitPadding={
            expanded && desktopMapLayout
              ? { topLeft: [380, 24], bottomRight: [24, 24] }
              : { topLeft: [24, 24], bottomRight: [24, 24] }
          }
        />
      </Suspense>
    )
  }

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    applyCatalogParam(next, key, value)
    persistFilters(next)
    setSearchParams(next)
  }

  const updateParams = (entries: Array<{ key: string; value: string }>) => {
    const next = new URLSearchParams(searchParams)
    entries.forEach(({ key, value }) => applyCatalogParam(next, key, value))
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

  const formatEuro = (value: number) => formatEuroAmount(value)

  return (
    <main className="catalog-page">
      <section className={isMapView ? 'catalog-hero is-collapsed' : 'catalog-hero'}>
        <div className="container">
          <h1 className="section-title">Nos biens dans l&apos;Ouest Lyonnais</h1>
          <p className="catalog-hero__intro">
            {mode === 'rent'
              ? 'Des biens en location choisis pour leur emplacement, leur confort et leur qualité de vie.'
              : 'Des maisons et appartements choisis pour leur adresse, leur potentiel et leur qualité de vie.'}
          </p>
          <SearchBar
            action={mode === 'rent' ? '/louer' : '/acheter'}
            compact
            cityOptions={availableCities}
            initialValues={{ type, budget: budgetForSearchBar, city: q }}
            onSearch={(filters) => {
              updateParams([
                { key: 'type', value: filters.type },
                { key: 'budgetMax', value: filters.budgetMax },
                { key: 'q', value: filters.city },
              ])
            }}
          />
        </div>
      </section>
      <section className="catalog-body section section--cream">
        <div className="container catalog-layout">
          <button className="catalog-filter-toggle" type="button" onClick={() => setMobileFiltersOpen((value) => !value)}>
            Filtres avancés
          </button>
          <aside className={`catalog-sidebar ${mobileFiltersOpen ? 'is-open' : ''}`}>
            <div className="catalog-filter-card">
              <FilterSelect
                label="Type"
                value={type}
                onValueChange={(value) => updateParam('type', value)}
                options={TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
              <label className="catalog-filter__group">
                <span className="catalog-filter__label">Ville</span>
                <Popover.Root open={cityFilterOpen} onOpenChange={setCityFilterOpen}>
                  <Popover.Trigger asChild>
                    <button type="button" className="catalog-filter__city-trigger" aria-label="Filtrer par ville">
                      <Search size={14} />
                      <span>{q ? q : 'Toutes les villes'}</span>
                      <ChevronDown size={14} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content className="catalog-filter__city-popover" sideOffset={8} align="start">
                      <Command className="catalog-filter__city-command" shouldFilter={false}>
                        <div className="catalog-filter__city-input-wrap">
                          <Search size={14} />
                          <Command.Input
                            className="catalog-filter__city-input"
                            placeholder="Ville, commune, arrondissement…"
                            value={cityFilterQuery}
                            onValueChange={setCityFilterQuery}
                          />
                          {q ? (
                            <button
                              type="button"
                              className="catalog-filter__city-clear"
                              aria-label="Réinitialiser la ville"
                              onClick={() => {
                                updateParams([
                                  { key: 'q', value: 'all' },
                                  { key: 'radius', value: 'all' },
                                ])
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
                              updateParams([
                                { key: 'q', value: 'all' },
                                { key: 'radius', value: 'all' },
                              ])
                              setCityFilterQuery('')
                              setCityFilterOpen(false)
                            }}
                          >
                            <span>Toutes les villes</span>
                            {q ? null : <Check size={14} />}
                          </Command.Item>
                          {communeLoading ? (
                            <p className="catalog-filter__city-empty">Recherche en cours…</p>
                          ) : null}
                          {!communeLoading &&
                          cityFilterQuery.trim().length >= 2 &&
                          sidebarCityMatches.length === 0 &&
                          sidebarRemoteCommunes.length === 0 ? (
                            <Command.Empty className="catalog-filter__city-empty">Aucune ville trouvée.</Command.Empty>
                          ) : null}
                          {sidebarCityMatches.map((entry) => (
                            <Command.Item
                              key={entry}
                              value={entry}
                              className="catalog-filter__city-item"
                              onSelect={() => {
                                updateParam('q', entry)
                                setCityFilterQuery(entry)
                                setCityFilterOpen(false)
                              }}
                            >
                              <span>{entry}</span>
                              {q === entry ? <Check size={14} /> : null}
                            </Command.Item>
                          ))}
                          {sidebarRemoteCommunes.map((entry) => (
                            <Command.Item
                              key={entry.code}
                              value={`${entry.name}-${entry.code}`}
                              className="catalog-filter__city-item"
                              onSelect={() => {
                                updateParam('q', entry.name)
                                setCityFilterQuery(entry.name)
                                setCityFilterOpen(false)
                              }}
                            >
                              <span>{formatCommuneLabel(entry)}</span>
                              {q === entry.name ? <Check size={14} /> : null}
                            </Command.Item>
                          ))}
                        </Command.List>
                      </Command>
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </label>
              <FilterSelect
                label="Rayon"
                value={String(radiusKm || 0)}
                disabled={!locationQuery}
                onValueChange={(value) => updateParam('radius', value === '0' ? 'all' : value)}
                options={[
                  { value: '0', label: 'Ville uniquement' },
                  { value: '5', label: '5 km autour' },
                  { value: '10', label: '10 km autour' },
                  { value: '15', label: '15 km autour' },
                  { value: '20', label: '20 km autour' },
                  { value: '30', label: '30 km autour' },
                ]}
              />
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
                  {budgetMaxForFilter == null
                    ? 'Sans Budget Max'
                    : `jusqu'à ${formatEuro(budgetMaxForFilter)}${rentBudgetSuffix}`}
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
                      { key: 'budgetMax', value: maxParam },
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
                <span className="catalog-filter__label">Critères</span>
                <div className="catalog-chips">
                  {(['jardin', 'piscine', 'terrasse', 'garage'] as Amenity[]).map((amenity) => (
                    <button key={amenity} type="button" className={`catalog-chip ${amenities.includes(amenity) ? 'is-active' : ''}`} onClick={() => toggleAmenity(amenity)}>{amenity}</button>
                  ))}
                </div>
              </div>
            </div>
            {!isMapView && widePreview ? (
              <aside className="catalog-map-panel">
                {renderCatalogMap(false, true)}
              </aside>
            ) : null}
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <p>
                {isLoading
                  ? 'Chargement...'
                  : apiError === 'quota'
                    ? 'Catalogue indisponible'
                    : apiError
                    ? 'Les biens ne se chargent pas'
                    : zoneActive
                      ? (
                          <>
                            {listedProperties.length} bien{listedProperties.length !== 1 ? 's' : ''} dans cette zone
                            <span className="catalog-toolbar__hint">sur {catalogProperties.length} au total</span>
                          </>
                        )
                      : listedProperties.length === 0
                        ? 'Aucun bien'
                        : `${listedProperties.length} bien${listedProperties.length !== 1 ? 's' : ''} trouvé${listedProperties.length !== 1 ? 's' : ''}`}
              </p>
              <div className="catalog-toolbar__end">
                <nav className="catalog-view-toggle" aria-label="Affichage des biens">
                  <Link to={`${listingPath}${listSearch}`} aria-current={!isMapView ? 'page' : undefined}>
                    Liste
                  </Link>
                  <Link to={`${listingPath}${mapSearch}`} aria-current={isMapView ? 'page' : undefined}>
                    Carte
                  </Link>
                </nav>
                <FilterSelect label="Trier" value={sort} onValueChange={(value) => updateParam('sort', value)} options={[
                  { value: 'recent', label: 'Plus récents' }, { value: 'price-asc', label: 'Prix croissant' }, { value: 'price-desc', label: 'Prix décroissant' }, { value: 'surface', label: 'Surface' },
                ]} />
              </div>
            </div>
            {cacheServedAt && !apiError && !isLoading ? (
              <p className="catalog-toolbar__hint" role="status">
                Version enregistrée de{' '}
                {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(cacheServedAt))}
              </p>
            ) : null}
            {apiError ? (
              <div className="catalog-grid">
                <div className="catalog-map-empty">
                  {apiError === 'quota' ? (
                    <p>
                      Le catalogue est momentanément indisponible, réessayez plus tard ou appelez le{' '}
                      <a href="tel:+33478850827">04 78 85 08 27</a>.
                    </p>
                  ) : (
                    <p>
                      Les biens ne se chargent pas.{' '}
                      <a href="tel:+33478850827">04 78 85 08 27</a>
                    </p>
                  )}
                  <div className="catalog-map-empty__actions">
                    <button type="button" className="is-primary" onClick={reloadProperties}>
                      Réessayer
                    </button>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="catalog-grid">
                <div className="catalog-map-loading">Chargement des biens…</div>
              </div>
            ) : isMapView ? (
              <div className="catalog-map-view" role="region" aria-label="Carte des biens">
                <div className="catalog-map-results" ref={mapResultsRef}>
                  {listedProperties.length === 0 && zoneActive ? (
                    <div className="catalog-map-empty">
                      <p>Aucun bien dans cette zone</p>
                      <div className="catalog-map-empty__actions">
                        <button type="button" onClick={() => setWidenSignal((value) => value + 1)}>
                          Élargir la carte
                        </button>
                        <button
                          type="button"
                          className="is-primary"
                          onClick={() => {
                            setVisibleZone(null)
                            setFitAllSignal((value) => value + 1)
                          }}
                        >
                          Voir tous les biens
                        </button>
                      </div>
                    </div>
                  ) : (
                    listedProperties.slice(0, visibleCount).map((property, index) => (
                      <div key={property.slug} data-property-slug={property.slug}>
                        <PropertyCard
                          property={property}
                          light
                          highlighted={hoveredPropertySlug === property.slug}
                          onHoverChange={handleHoverFromList}
                          priorityImage={index < 3}
                        />
                      </div>
                    ))
                  )}
                </div>
                <div className="catalog-map-stage">{renderCatalogMap(true, true)}</div>
              </div>
            ) : listedProperties.length === 0 ? (
              <div className="catalog-map-empty">
                <p>Aucun bien ne correspond à votre recherche</p>
                <div className="catalog-map-empty__actions">
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams()
                      persistFilters(next)
                      setSearchParams(next)
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => {
                      const next = new URLSearchParams()
                      persistFilters(next)
                      setSearchParams(next)
                    }}
                  >
                    Voir tous les biens
                  </button>
                </div>
                <p>
                  <Link to="/contact">Contacter l&apos;agence</Link>
                </p>
              </div>
            ) : (
              <div className="catalog-grid">
                {listedProperties.slice(0, visibleCount).map((property, index) => (
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
    </main>
  )
}
