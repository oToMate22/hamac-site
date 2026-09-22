import { useEffect, useMemo, useState, type FormEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import {
  Briefcase,
  Building,
  Building2,
  Car,
  Check,
  ChevronDown,
  Home,
  LandPlot,
  Plus,
  Search,
  Store,
} from 'lucide-react'
import { Command } from 'cmdk'
import { NEIGHBORHOODS } from '../data/neighborhoods'
import { useFrenchCommuneSearch } from '../hooks/useFrenchCommuneSearch'
import { formatCommuneLabel } from '../utils/frenchCommunes'
import {
  TYPE_OPTIONS,
  budgetMaxOptions,
  catalogModeFromAction,
  formatBudgetMaxLabel,
} from './criteria'

const TYPE_ICONS: Record<string, typeof Home> = {
  all: Home,
  maison: Home,
  appartement: Building2,
  terrain: LandPlot,
  commerce: Store,
  bureau: Briefcase,
  garage: Car,
  immeuble: Building,
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getCityMatchScore = (cityName: string, query: string) => {
  const normalizedCity = normalize(cityName)
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return 1
  if (!normalizedCity.includes(normalizedQuery)) return 0
  const words = normalizedCity.split(/[\s'-]+/).filter(Boolean)
  return words.some((word) => word.startsWith(normalizedQuery)) ? 2 : 1
}

const highlightMatch = (label: string, search: string) => {
  const normalizedLabel = normalize(label)
  const normalizedSearch = normalize(search)
  if (!normalizedSearch) {
    return <>{label}</>
  }

  const start = normalizedLabel.indexOf(normalizedSearch)
  if (start < 0) {
    return <>{label}</>
  }

  const end = start + normalizedSearch.length
  return (
    <>
      {label.slice(0, start)}
      <mark className="premium-search__mark">{label.slice(start, end)}</mark>
      {label.slice(end)}
    </>
  )
}

const DEFAULT_CITY_OPTIONS = NEIGHBORHOODS.map((n) => n.name)

function HeroMagnifyingGlass({ className, size = 20 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  )
}

type SearchBarProps = {
  action: string
  compact?: boolean
  /** Barre unifiée glassmorphism (hero homepage) */
  variant?: 'default' | 'hero-glass'
  cityOptions?: string[]
  initialValues?: {
    type?: string
    budget?: string
    city?: string
  }
  onSearch?: (filters: { type: string; budgetMax: string; city: string }) => void
}

export function SearchBar({
  action,
  compact = false,
  variant = 'default',
  cityOptions = [],
  initialValues,
  onSearch,
}: SearchBarProps) {
  const [type, setType] = useState(initialValues?.type ?? 'all')
  const [budget, setBudget] = useState(initialValues?.budget ?? 'all')
  const [city, setCity] = useState(initialValues?.city ?? '')
  const [cityQuery, setCityQuery] = useState('')
  const [cityOpen, setCityOpen] = useState(false)
  const catalogMode = catalogModeFromAction(action)

  useEffect(() => {
    setType(initialValues?.type ?? 'all')
    setBudget(initialValues?.budget ?? 'all')
    setCity(initialValues?.city ?? '')
  }, [initialValues?.type, initialValues?.budget, initialValues?.city])

  const budgetOptions = useMemo(() => {
    const list = budgetMaxOptions(catalogMode).map((option) => ({ ...option }))
    if (budget && budget !== 'all' && !list.some((option) => option.value === budget)) {
      const n = Number(budget)
      list.splice(1, 0, {
        value: budget,
        label: Number.isFinite(n) ? formatBudgetMaxLabel(n, catalogMode) : budget,
      })
    }
    return list
  }, [budget, catalogMode])

  const effectiveCityOptions = cityOptions.length > 0 ? cityOptions : DEFAULT_CITY_OPTIONS
  const { results: communeResults, loading: communeLoading } = useFrenchCommuneSearch(cityQuery, cityOpen)

  const filteredCities = useMemo(() => {
    return effectiveCityOptions
      .map((entry) => ({ entry, score: getCityMatchScore(entry, cityQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.localeCompare(b.entry, 'fr'))
      .map((item) => item.entry)
  }, [effectiveCityOptions, cityQuery])

  const remoteCommunes = useMemo(() => {
    const local = new Set(filteredCities.map((entry) => normalize(entry)))
    return communeResults.filter((entry) => !local.has(normalize(entry.name)))
  }, [communeResults, filteredCities])

  const chevronSize = variant === 'hero-glass' ? 12 : 14

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (onSearch) {
      onSearch({ type, budgetMax: budget, city })
      return
    }
    const params = new URLSearchParams()
    if (type !== 'all') params.set('type', type)
    if (city) params.set('q', city)
    if (budget !== 'all') params.set('budgetMax', budget)

    const target = params.toString() ? `${action}?${params.toString()}` : action
    window.location.assign(target)
  }

  return (
    <>
      <form
        className={[
          'search-card',
          'premium-search',
          compact ? 'premium-search--compact' : '',
          variant === 'hero-glass' ? 'premium-search--hero-glass' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        action={action}
        method="get"
        role="search"
        aria-label="Recherche de biens"
        onSubmit={submitSearch}
      >
        <div className="search-card__fields premium-search__fields">
          <label className="search-field premium-search__field">
            <span className="search-field__pill premium-search__pill">
              <span className="search-field__label">Type</span>
              <Select.Root value={type} onValueChange={setType}>
                <Select.Trigger className="premium-search__select-trigger" aria-label="Type">
                  <Select.Value placeholder="Tous" />
                  <Select.Icon>
                    <ChevronDown size={chevronSize} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="premium-search__select-content" position="popper" sideOffset={8}>
                    <Select.Viewport className="premium-search__select-viewport">
                      {TYPE_OPTIONS.map((option) => {
                        const Icon = TYPE_ICONS[option.value] ?? Home
                        return (
                          <Select.Item key={option.value} value={option.value} className="premium-search__select-item">
                            <div className="premium-search__item-main">
                              <Icon size={14} className="premium-search__item-icon" />
                              <Select.ItemText>{option.label}</Select.ItemText>
                            </div>
                            <Select.ItemIndicator>
                              <Check size={14} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        )
                      })}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </span>
          </label>

          <label className="search-field premium-search__field">
            <span className="search-field__pill premium-search__pill">
              <span className="search-field__label">Lieu</span>
              <Popover.Root open={cityOpen} onOpenChange={setCityOpen}>
                <Popover.Trigger asChild>
                  <button type="button" className="premium-search__combobox-trigger" aria-label="Choisir un lieu">
                    <Search size={variant === 'hero-glass' ? 12 : 14} className="premium-search__search-icon" />
                    <span
                      className={
                        city
                          ? 'premium-search__city-value'
                          : 'premium-search__city-value premium-search__city-value--placeholder'
                      }
                    >
                      {city || '\u00a0'}
                    </span>
                    <ChevronDown size={chevronSize} className="premium-search__chevron" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content className="premium-search__popover" sideOffset={8} align="start">
                    <Command className="premium-search__command" shouldFilter={false}>
                      <div className="premium-search__command-input-wrap">
                        <Search size={14} className="premium-search__search-icon" />
                        <Command.Input
                          className="premium-search__command-input"
                          placeholder="Quartier, ville, arrondissement…"
                          value={cityQuery}
                          onValueChange={setCityQuery}
                        />
                        {city ? (
                          <button
                            type="button"
                            className="premium-search__clear"
                            aria-label="Réinitialiser la ville"
                            onClick={() => {
                              setCity('')
                              setCityQuery('')
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                      </div>
                      <Command.List className="premium-search__command-list">
                        {communeLoading ? (
                          <p className="premium-search__empty">Recherche en cours…</p>
                        ) : null}
                        {!communeLoading &&
                        cityQuery.trim().length >= 2 &&
                        filteredCities.length === 0 &&
                        remoteCommunes.length === 0 ? (
                          <Command.Empty className="premium-search__empty">Aucune ville trouvée.</Command.Empty>
                        ) : null}
                        {filteredCities.map((entry) => (
                          <Command.Item
                            key={entry}
                            value={entry}
                            className="premium-search__command-item"
                            onSelect={() => {
                              setCity(entry)
                              setCityQuery(entry)
                              setCityOpen(false)
                            }}
                          >
                            <span>{highlightMatch(entry, cityQuery)}</span>
                            {city === entry ? <Check size={14} /> : null}
                          </Command.Item>
                        ))}
                        {remoteCommunes.map((entry) => (
                          <Command.Item
                            key={entry.code}
                            value={`${entry.name}-${entry.code}`}
                            className="premium-search__command-item"
                            onSelect={() => {
                              setCity(entry.name)
                              setCityQuery(entry.name)
                              setCityOpen(false)
                            }}
                          >
                            <span>{highlightMatch(formatCommuneLabel(entry), cityQuery)}</span>
                            {city === entry.name ? <Check size={14} /> : null}
                          </Command.Item>
                        ))}
                      </Command.List>
                    </Command>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
              <input type="hidden" name="q" value={city} />
            </span>
          </label>

          <label className="search-field premium-search__field">
            <span className="search-field__pill premium-search__pill">
              <span className="search-field__label">Budget</span>
              <Select.Root value={budget} onValueChange={setBudget}>
                <Select.Trigger className="premium-search__select-trigger" aria-label="Budget">
                  <Select.Value placeholder="Tous" />
                  <Select.Icon>
                    <ChevronDown size={chevronSize} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="premium-search__select-content" position="popper" sideOffset={8}>
                    <Select.Viewport className="premium-search__select-viewport">
                      {budgetOptions.map((option) => (
                        <Select.Item key={option.value} value={option.value} className="premium-search__select-item">
                          <div className="premium-search__item-main">
                            <Select.ItemText>{option.label}</Select.ItemText>
                          </div>
                          <Select.ItemIndicator>
                            <Check size={14} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </span>
          </label>
        </div>

        <div
          className={[
            'search-card__actions',
            'premium-search__actions',
            variant === 'hero-glass' ? 'hero-search__actions' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {variant === 'hero-glass' ? (
            <a
              href={action}
              className="hero-search__plus"
              aria-label="Ouvrir le catalogue avec tous les filtres"
              title="Plus de critères"
            >
              <Plus size={15} strokeWidth={2.1} aria-hidden />
            </a>
          ) : null}
          <button type="submit" className="search-card__submit premium-search__submit">
            <span className="search-card__submit-inner premium-search__submit-inner">
              {variant === 'hero-glass' ? (
                <HeroMagnifyingGlass className="search-card__submit-icon hero-search__submit-icon" size={16} />
              ) : (
                <Search className="search-card__submit-icon" size={18} />
              )}
              <span className="search-card__submit-label">Rechercher</span>
            </span>
          </button>
        </div>
      </form>
    </>
  )
}
