import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import * as Slider from '@radix-ui/react-slider'
import { Check, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
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
const CATALOG_PAGE_SIZE = 32

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

/** Pastilles feuille mobile — libellés courts (planche C). */
const SHEET_TYPE_PILLS = [
  { value: 'all', label: 'Tous' },
  { value: 'maison', label: 'Maison' },
  { value: 'appartement', label: 'Appartement' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'bureau', label: 'Bureau' },
  { value: 'garage', label: 'Garage' },
  { value: 'immeuble', label: 'Immeuble' },
] as const

const SHEET_CITY_PILLS = [
  'Sainte-Foy-lès-Lyon',
  'Tassin-la-Demi-Lune',
  'Écully',
  'Francheville',
  'Craponne',
  'Oullins',
] as const

const SHEET_ROOMS_PILLS = [
  { value: 'all', label: 'Toutes' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
] as const

function FilterPills({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="catalog-filter__group">
      <span className="catalog-filter__label">{label}</span>
      <div className="catalog-filter-pills" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`catalog-filter-pill${value === option.value ? ' is-active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
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

  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE)
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
  /** Une ou plusieurs villes (séparées par des virgules dans `q`). */
  const selectedCities = q
    ? q
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []
  const locationQuery = selectedCities.length === 1 ? selectedCities[0] : ''
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

    const applySort = (list: Property[]) => {
      const sorted = [...list]
      if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price)
      if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price)
      if (sort === 'surface') sorted.sort((a, b) => b.surface - a.surface)
      if (sort === 'recent') sorted.sort((a, b) => (a.reference < b.reference ? 1 : -1))
      return sorted
    }

    const filters = {
      type: type.toLowerCase(),
      cities: selectedCities,
      radiusKm,
      origin,
      budgetMin: budgetMinValue > 0 ? budgetMinValue : undefined,
      budgetMax: budgetMaxForFilter,
      surfaceMin: surface !== 'all' ? Number(surface) : undefined,
      bedroomsMin: rooms !== 'all' ? Number(rooms) : undefined,
      amenities,
    }

    const useRadius = Boolean(filters.radiusKm > 0 && filters.origin && filters.cities.length === 1)
    const center = filters.origin

    const filtered = apiProperties.filter((property) => {
      if (filters.type && filters.type !== 'all' && property.type.toLowerCase() !== filters.type) return false
      if (useRadius && center) {
        if (!Number.isFinite(property.lat) || !Number.isFinite(property.lng)) return false
        if (distanceKm(center, { lat: property.lat, lng: property.lng }) > filters.radiusKm) return false
      } else if (
        filters.cities.length > 0 &&
        !filters.cities.some((city) => matchesCitySearch(property.city, city))
      ) {
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

  useEffect(
    () => setVisibleCount(CATALOG_PAGE_SIZE),
    [type, budgetMaxForFilter, budgetMinValue, surface, rooms, sort, q, radiusKm, visibleZone],
  )
  useEffect(() => {
    // Ne pas coller « Écully,Tassin… » dans le champ Autre commune
    if (selectedCities.length === 1) setCityFilterQuery(selectedCities[0])
    else if (selectedCities.length === 0) setCityFilterQuery('')
  }, [q])

  useEffect(() => {
    if (!mobileFiltersOpen || desktopMapLayout) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileFiltersOpen, desktopMapLayout])

  const openSheetToSection = useCallback((sectionId: string) => {
    setMobileFiltersOpen(true)
    window.setTimeout(() => {
      if (sectionId === 'catalog-filter-chambres') {
        const details = document.getElementById('catalog-filter-more')
        if (details instanceof HTMLDetailsElement) details.open = true
      }
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }, [])

  const isLoading = apiProperties === null && apiError === null
  const zoneActive = Boolean(visibleZone && isMapView)
  const propertiesForMap = !isLoading && !apiError ? catalogProperties : []
  const visibleProperties = listedProperties.slice(0, visibleCount)
  const hasMoreProperties = listedProperties.length > visibleCount
  const loadMoreProperties = () => {
    setVisibleCount((count) => Math.min(count + CATALOG_PAGE_SIZE, listedProperties.length))
  }

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

  const isCitySelected = (city: string) =>
    selectedCities.some((entry) => normalize(entry) === normalize(city))

  const writeSelectedCities = (cities: string[]) => {
    const unique: string[] = []
    for (const city of cities) {
      const trimmed = city.trim()
      if (!trimmed) continue
      if (unique.some((entry) => normalize(entry) === normalize(trimmed))) continue
      unique.push(trimmed)
    }
    updateParams([
      { key: 'q', value: unique.length ? unique.join(',') : 'all' },
      // Le rayon n’a de sens que pour une seule ville
      ...(unique.length === 1 ? [] : [{ key: 'radius', value: 'all' }]),
    ])
  }

  const toggleCitySelection = (city: string) => {
    if (isCitySelected(city)) {
      writeSelectedCities(selectedCities.filter((entry) => normalize(entry) !== normalize(city)))
      return
    }
    writeSelectedCities([...selectedCities, city])
  }

  const clearCitySelections = () => {
    writeSelectedCities([])
    setCityFilterQuery('')
  }

  const formatEuro = (value: number) => formatEuroAmount(value)

  const typeLabel = TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type
  const activeFilterChips: Array<{ key: string; label: string; clear: Array<{ key: string; value: string }> }> = []
  if (type && type !== 'all') {
    activeFilterChips.push({ key: 'type', label: typeLabel, clear: [{ key: 'type', value: 'all' }] })
  }
  for (const city of selectedCities) {
    activeFilterChips.push({
      key: `city:${city}`,
      label: city,
      clear: [],
    })
  }
  if (budgetMinValue > 0 || budgetMaxForFilter != null) {
    const budgetLabel =
      budgetMinValue > 0 && budgetMaxForFilter != null
        ? `${formatEuro(budgetMinValue)} – ${formatEuro(budgetMaxForFilter)}`
        : budgetMinValue > 0
          ? `≥ ${formatEuro(budgetMinValue)}`
          : `≤ ${formatEuro(budgetMaxForFilter!)}`
    activeFilterChips.push({
      key: 'budget',
      label: budgetLabel,
      clear: [
        { key: 'budgetMin', value: 'all' },
        { key: 'budgetMax', value: 'all' },
      ],
    })
  }
  if (surface !== 'all') {
    activeFilterChips.push({
      key: 'surface',
      label: `≥ ${surface} m²`,
      clear: [{ key: 'surface', value: 'all' }],
    })
  }
  if (rooms !== 'all') {
    activeFilterChips.push({
      key: 'rooms',
      label: `${rooms}+ ch.`,
      clear: [{ key: 'rooms', value: 'all' }],
    })
  }
  for (const amenity of amenities) {
    activeFilterChips.push({
      key: `amenity-${amenity}`,
      label: amenity,
      clear: [],
      // cleared via toggleAmenity below
    })
  }
  const activeFilterCount = activeFilterChips.length

  const remainingProperties = Math.max(listedProperties.length - visibleProperties.length, 0)

  // Animation d’entrée une seule fois ; filtres / pagination = apparition immédiate (opacity 1).
  const filterSignature = [
    type,
    q,
    budgetMinValue,
    budgetMaxForFilter ?? '',
    surface,
    rooms,
    amenities.join(','),
    sort,
    radiusKm,
  ].join('|')
  const cardMotionRef = useRef({ signature: filterSignature, visibleCount, enabled: true })
  if (
    cardMotionRef.current.signature !== filterSignature ||
    cardMotionRef.current.visibleCount !== visibleCount
  ) {
    cardMotionRef.current = { signature: filterSignature, visibleCount, enabled: false }
  }
  const cardMotionEnabled = cardMotionRef.current.enabled

  const resultsCountLabel = isLoading
    ? 'Chargement...'
    : apiError === 'quota'
      ? 'Catalogue indisponible'
      : apiError
        ? 'Les biens ne se chargent pas'
        : zoneActive
          ? (
              <>
                {`${listedProperties.length} bien${listedProperties.length !== 1 ? 's' : ''} dans cette zone`}
                <span className="catalog-toolbar__hint">{catalogProperties.length} au total</span>
              </>
            )
          : listedProperties.length === 0
            ? 'Aucun bien'
            : `${listedProperties.length} bien${listedProperties.length !== 1 ? 's' : ''}`

  const sheetCountLabel =
    !isLoading && !apiError
      ? `${listedProperties.length} bien${listedProperties.length !== 1 ? 's' : ''}`
      : null

  return (
    <main className="catalog-page">
      <section className={isMapView ? 'catalog-hero is-collapsed' : 'catalog-hero'}>
        <div className="container">
          <h1 className="section-title">
            {mode === 'rent' ? 'Nos biens à louer' : 'Nos biens à vendre'}
          </h1>
          <p className="catalog-hero__intro">
            {mode === 'rent'
              ? 'Des biens en location choisis pour leur emplacement, leur confort et leur qualité de vie.'
              : 'Des maisons et appartements choisis pour leur adresse, leur potentiel et leur qualité de vie.'}
          </p>
          <SearchBar
            action={mode === 'rent' ? '/louer' : '/acheter'}
            compact
            omitSubmit={!desktopMapLayout}
            cityOptions={availableCities}
            initialValues={{
              type,
              budget: budgetForSearchBar,
              city: selectedCities.length <= 1 ? (selectedCities[0] ?? '') : selectedCities.join(', '),
            }}
            onSearch={(filters) => {
              updateParams([
                { key: 'type', value: filters.type },
                { key: 'budgetMax', value: filters.budgetMax },
                { key: 'q', value: filters.city },
              ])
            }}
            trailingAction={
              !desktopMapLayout ? (
                <button
                  type="button"
                  className="catalog-filter-button"
                  aria-expanded={mobileFiltersOpen}
                  aria-controls="catalog-filters"
                  onClick={() => setMobileFiltersOpen((value) => !value)}
                >
                  <SlidersHorizontal size={18} aria-hidden />
                  <span className="catalog-filter-button__label">Filtres</span>
                  {activeFilterCount > 0 ? (
                    <span className="catalog-filter-button__badge">{activeFilterCount}</span>
                  ) : null}
                </button>
              ) : undefined
            }
          />
          {!desktopMapLayout ? (
            <div className="catalog-active-chips" aria-label="Filtres rapides">
              {type !== 'all' ? (
                <button
                  type="button"
                  className="catalog-chip is-active"
                  aria-label={`Retirer le filtre ${typeLabel}`}
                  onClick={() => updateParam('type', 'all')}
                >
                  <span>{typeLabel}</span>
                  <X size={12} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="catalog-chip"
                  onClick={() => openSheetToSection('catalog-filter-type')}
                >
                  <span>Tous types</span>
                </button>
              )}
              {budgetMinValue > 0 || budgetMaxForFilter != null ? (
                <button
                  type="button"
                  className="catalog-chip is-active"
                  aria-label="Retirer le filtre budget"
                  onClick={() =>
                    updateParams([
                      { key: 'budgetMin', value: 'all' },
                      { key: 'budgetMax', value: 'all' },
                    ])
                  }
                >
                  <span>
                    {budgetMinValue > 0 && budgetMaxForFilter != null
                      ? `${formatEuro(budgetMinValue)} – ${formatEuro(budgetMaxForFilter)}`
                      : budgetMinValue > 0
                        ? `≥ ${formatEuro(budgetMinValue)}`
                        : `≤ ${formatEuro(budgetMaxForFilter!)}`}
                    {mode === 'rent' ? ' / mois' : ''}
                  </span>
                  <X size={12} aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  className="catalog-chip"
                  onClick={() => openSheetToSection('catalog-filter-budget')}
                >
                  <span>
                    {mode === 'rent' ? `≤ ${formatEuro(3_000)} / mois` : `≤ ${formatEuro(1_500_000)}`}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="catalog-chip is-add"
                onClick={() => openSheetToSection('catalog-filter-ville')}
              >
                <span>+ Ville</span>
              </button>
              <button
                type="button"
                className="catalog-chip is-add"
                onClick={() => openSheetToSection('catalog-filter-chambres')}
              >
                <span>+ Chambres</span>
              </button>
              {activeFilterChips
                .filter((chip) => chip.key !== 'type' && chip.key !== 'budget')
                .map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="catalog-chip is-active"
                    aria-label={`Retirer le filtre ${chip.label}`}
                    onClick={() => {
                      if (chip.key.startsWith('amenity-')) {
                        toggleAmenity(chip.key.replace('amenity-', '') as Amenity)
                        return
                      }
                      if (chip.key.startsWith('city:')) {
                        toggleCitySelection(chip.key.slice('city:'.length))
                        return
                      }
                      updateParams(chip.clear)
                    }}
                  >
                    <span>{chip.label}</span>
                    <X size={12} aria-hidden />
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      </section>
      <section className="catalog-body section section--cream">
        <div className="container catalog-layout">
          {mobileFiltersOpen && !desktopMapLayout ? (
            <button
              type="button"
              className="catalog-filter-sheet__veil"
              aria-label="Fermer les filtres"
              onClick={() => setMobileFiltersOpen(false)}
            />
          ) : null}
          <aside
            id="catalog-filters"
            className={`catalog-sidebar${mobileFiltersOpen ? ' is-open' : ''}${desktopMapLayout ? '' : ' catalog-filter-sheet'}`}
          >
            <div className="catalog-filter-sheet__chrome">
              <div className="catalog-filter-sheet__handle" aria-hidden />
              <div className="catalog-filter-sheet__title-row">
                <p>
                  Filtres
                  {sheetCountLabel ? (
                    <span className="catalog-filter-sheet__count">{` · ${sheetCountLabel}`}</span>
                  ) : null}
                </p>
                <button type="button" aria-label="Fermer les filtres" onClick={() => setMobileFiltersOpen(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="catalog-filter-card">
              {!desktopMapLayout ? (
                <div id="catalog-filter-type">
                  <FilterPills
                    label="Type de bien"
                    options={SHEET_TYPE_PILLS}
                    value={type}
                    onChange={(value) => updateParam('type', value)}
                  />
                </div>
              ) : null}
              <label className="catalog-filter__group" id="catalog-filter-budget">
                <span className="catalog-filter__label">
                  {mode === 'rent' ? 'Loyer (min. — max.)' : 'Budget (min. — max.)'}
                </span>
                {desktopMapLayout ? (
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
                ) : null}
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
                {!desktopMapLayout ? (
                  <div className="catalog-filter-budget-pills" aria-live="polite">
                    <span className="catalog-filter-pill is-budget">
                      de {formatEuro(budgetMinValue)}
                      {rentBudgetSuffix}
                    </span>
                    <span className="catalog-filter-pill is-budget">
                      jusqu&apos;à {formatEuro(budgetMaxThumb)}
                      {rentBudgetSuffix}
                    </span>
                  </div>
                ) : null}
              </label>
              {!desktopMapLayout ? (
                <div className="catalog-filter__group" id="catalog-filter-ville">
                  <span className="catalog-filter__label">Ville (plusieurs possibles)</span>
                  <div className="catalog-filter-pills" role="group" aria-label="Ville">
                    <button
                      type="button"
                      className={`catalog-filter-pill${selectedCities.length === 0 ? ' is-active' : ''}`}
                      aria-pressed={selectedCities.length === 0}
                      onClick={clearCitySelections}
                    >
                      Toutes
                    </button>
                    {SHEET_CITY_PILLS.map((city) => (
                      <button
                        key={city}
                        type="button"
                        className={`catalog-filter-pill${isCitySelected(city) ? ' is-active' : ''}`}
                        aria-pressed={isCitySelected(city)}
                        onClick={() => toggleCitySelection(city)}
                      >
                        {city}
                      </button>
                    ))}
                    {selectedCities
                      .filter((city) => !(SHEET_CITY_PILLS as readonly string[]).some((entry) => normalize(entry) === normalize(city)))
                      .map((city) => (
                        <button
                          key={city}
                          type="button"
                          className="catalog-filter-pill is-active"
                          aria-pressed
                          onClick={() => toggleCitySelection(city)}
                        >
                          {city}
                          <X size={12} aria-hidden />
                        </button>
                      ))}
                  </div>
                  <Popover.Root
                    open={cityFilterOpen}
                    onOpenChange={(open) => {
                      setCityFilterOpen(open)
                      if (open) setCityFilterQuery('')
                    }}
                  >
                    <Popover.Trigger asChild>
                      <button type="button" className="catalog-filter__other-city" aria-label="Ajouter une autre commune">
                        <Search size={14} aria-hidden />
                        <span>Autre commune…</span>
                      </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        className="catalog-filter__city-popover catalog-filter__city-popover--sheet"
                        sideOffset={8}
                        align="start"
                        onOpenAutoFocus={(event) => {
                          // Laisser le focus sur l’input cmdk
                          event.preventDefault()
                          const input = document.querySelector<HTMLInputElement>(
                            '.catalog-filter__city-popover--sheet .catalog-filter__city-input',
                          )
                          input?.focus()
                        }}
                      >
                        <Command className="catalog-filter__city-command" shouldFilter={false}>
                          <div className="catalog-filter__city-input-wrap">
                            <Search size={14} />
                            <Command.Input
                              className="catalog-filter__city-input"
                              placeholder="Ajouter une commune…"
                              value={cityFilterQuery}
                              onValueChange={setCityFilterQuery}
                            />
                            {cityFilterQuery ? (
                              <button
                                type="button"
                                className="catalog-filter__city-clear"
                                aria-label="Effacer la recherche"
                                onClick={() => setCityFilterQuery('')}
                              >
                                <X size={14} />
                              </button>
                            ) : null}
                          </div>
                          <Command.List className="catalog-filter__city-list">
                            {communeLoading ? (
                              <p className="catalog-filter__city-empty">Recherche en cours…</p>
                            ) : null}
                            {!communeLoading &&
                            cityFilterQuery.trim().length >= 2 &&
                            sidebarCityMatches.length === 0 &&
                            sidebarRemoteCommunes.length === 0 ? (
                              <Command.Empty className="catalog-filter__city-empty">Aucune ville trouvée.</Command.Empty>
                            ) : null}
                            {cityFilterQuery.trim().length < 2 ? (
                              <p className="catalog-filter__city-empty">Tapez au moins 2 lettres</p>
                            ) : null}
                            {sidebarCityMatches.map((entry) => (
                              <Command.Item
                                key={entry}
                                value={entry}
                                className="catalog-filter__city-item"
                                onSelect={() => {
                                  toggleCitySelection(entry)
                                  setCityFilterQuery('')
                                }}
                              >
                                <span>{entry}</span>
                                {isCitySelected(entry) ? <Check size={14} /> : null}
                              </Command.Item>
                            ))}
                            {sidebarRemoteCommunes.map((entry) => (
                              <Command.Item
                                key={entry.code}
                                value={`${entry.name}-${entry.code}`}
                                className="catalog-filter__city-item"
                                onSelect={() => {
                                  toggleCitySelection(entry.name)
                                  setCityFilterQuery('')
                                }}
                              >
                                <span>{formatCommuneLabel(entry)}</span>
                                {isCitySelected(entry.name) ? <Check size={14} /> : null}
                              </Command.Item>
                            ))}
                          </Command.List>
                        </Command>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              ) : null}
              <details
                id="catalog-filter-more"
                className="catalog-filter-more"
                {...(desktopMapLayout ? { open: true } : {})}
              >
                <summary>Plus de filtres — surface, chambres, critères</summary>
                <div className="catalog-filter-more__panel">
                  <div className="catalog-filter-more__panel-inner">
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
                    <div id="catalog-filter-chambres">
                      {desktopMapLayout ? (
                        <FilterSelect
                          label="Chambres min"
                          value={rooms}
                          onValueChange={(value) => updateParam('rooms', value)}
                          options={[
                            { value: 'all', label: 'Toutes' },
                            { value: '1', label: '1+' },
                            { value: '2', label: '2+' },
                            { value: '3', label: '3+' },
                            { value: '4', label: '4+' },
                          ]}
                        />
                      ) : (
                        <FilterPills
                          label="Chambres min"
                          options={SHEET_ROOMS_PILLS}
                          value={rooms}
                          onChange={(value) => updateParam('rooms', value)}
                        />
                      )}
                    </div>
                    <div className="catalog-filter__group">
                      <span className="catalog-filter__label">Critères</span>
                      <div className="catalog-chips">
                        {(['jardin', 'piscine', 'terrasse', 'garage'] as Amenity[]).map((amenity) => (
                          <button
                            key={amenity}
                            type="button"
                            className={`catalog-chip ${amenities.includes(amenity) ? 'is-active' : ''}`}
                            onClick={() => toggleAmenity(amenity)}
                          >
                            {amenity}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
            <div className="catalog-filter-sheet__foot">
              <button
                type="button"
                className="catalog-filter-sheet__clear"
                onClick={() => {
                  const next = new URLSearchParams()
                  if (isMapView) next.set('view', 'map')
                  persistFilters(next)
                  setSearchParams(next)
                }}
              >
                Effacer
              </button>
              <button
                type="button"
                className="catalog-filter-sheet__apply"
                disabled={isLoading}
                onClick={() => setMobileFiltersOpen(false)}
              >
                {isLoading
                  ? 'Chargement…'
                  : `Voir les ${listedProperties.length} bien${listedProperties.length !== 1 ? 's' : ''}`}
              </button>
            </div>
            {!isMapView && widePreview ? (
              <aside className="catalog-map-panel">
                {renderCatalogMap(false, true)}
              </aside>
            ) : null}
          </aside>
          <div className="catalog-main">
            <div className="catalog-toolbar">
              <div className="catalog-toolbar__row">
                <p className="catalog-toolbar__count">{resultsCountLabel}</p>
                <div className="catalog-toolbar__end">
                  <nav className="catalog-view-toggle" aria-label="Affichage des biens">
                    <Link to={`${listingPath}${listSearch}`} aria-current={!isMapView ? 'page' : undefined}>
                      Liste
                    </Link>
                    <Link to={`${listingPath}${mapSearch}`} aria-current={isMapView ? 'page' : undefined}>
                      Carte
                    </Link>
                  </nav>
                  <div className="catalog-toolbar__sort">
                    <FilterSelect
                      label="Trier"
                      value={sort}
                      onValueChange={(value) => updateParam('sort', value)}
                      options={[
                        { value: 'recent', label: 'Plus récents' },
                        { value: 'price-asc', label: 'Prix croissant' },
                        { value: 'price-desc', label: 'Prix décroissant' },
                        { value: 'surface', label: 'Surface' },
                      ]}
                    />
                  </div>
                </div>
              </div>
              {desktopMapLayout && activeFilterChips.length > 0 ? (
                <div className="catalog-active-chips" aria-label="Filtres actifs">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      className="catalog-chip is-active"
                      aria-label={`Retirer le filtre ${chip.label}`}
                      onClick={() => {
                        if (chip.key.startsWith('amenity-')) {
                          toggleAmenity(chip.key.replace('amenity-', '') as Amenity)
                          return
                        }
                        if (chip.key.startsWith('city:')) {
                          toggleCitySelection(chip.key.slice('city:'.length))
                          return
                        }
                        updateParams(chip.clear)
                      }}
                    >
                      <span>{chip.label}</span>
                      <X size={12} aria-hidden />
                    </button>
                  ))}
                </div>
              ) : null}
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
                    <>
                      {visibleProperties.map((property, index) => (
                        <div key={property.slug} data-property-slug={property.slug}>
                          <PropertyCard
                            property={property}
                            light
                            highlighted={hoveredPropertySlug === property.slug}
                            onHoverChange={handleHoverFromList}
                            priorityImage={index < 3}
                          />
                        </div>
                      ))}
                      {hasMoreProperties ? (
                        <div className="catalog-load-more">
                          <button type="button" className="is-primary" onClick={loadMoreProperties}>
                            Voir les {remainingProperties} autres ({visibleProperties.length} affichés)
                          </button>
                        </div>
                      ) : null}
                    </>
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
              <>
                <div className="catalog-grid">
                  {visibleProperties.map((property, index) => {
                    const card = (
                      <PropertyCard
                        property={property}
                        light
                        highlighted={hoveredPropertySlug === property.slug}
                        onHoverChange={setHoveredPropertySlug}
                        priorityImage={index < 3}
                      />
                    )
                    if (!cardMotionEnabled) {
                      return (
                        <div key={property.slug} className="catalog-grid__item">
                          {card}
                        </div>
                      )
                    }
                    return (
                      <motion.div
                        key={property.slug}
                        className="catalog-grid__item"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.4, ease: 'easeOut', delay: Math.min(index * 0.08, 0.32) }}
                      >
                        {card}
                      </motion.div>
                    )
                  })}
                </div>
                {hasMoreProperties ? (
                  <div className="catalog-load-more">
                    <button type="button" className="is-primary" onClick={loadMoreProperties}>
                      Voir les {remainingProperties} autres ({visibleProperties.length} affichés)
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
