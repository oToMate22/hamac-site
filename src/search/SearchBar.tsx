import { useMemo, useState, type FormEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, Building2, Home, LandPlot, Plus, Search } from 'lucide-react'
import { Command } from 'cmdk'
import { NEIGHBORHOODS } from '../data/neighborhoods'

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tous', icon: Home },
  { value: 'maison', label: 'Maison', icon: Home },
  { value: 'appartement', label: 'Appartement', icon: Building2 },
  { value: 'terrain', label: 'Terrain', icon: LandPlot },
]

const BUDGET_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: '250000', label: 'Jusqu\'à 250 000 €' },
  { value: '500000', label: 'Jusqu\'à 500 000 €' },
  { value: '750000', label: 'Jusqu\'à 750 000 €' },
  { value: '800000', label: 'Jusqu\'à 800 000 €' },
  { value: '1000000', label: 'Jusqu\'à 1 000 000 €' },
  { value: '1500000', label: '1 000 000 € et +' },
  { value: '1950000', label: 'Jusqu\'à 1 950 000 €' },
]

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
  onSearch?: (filters: { type: string; budget: string; city: string }) => void
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

  const effectiveCityOptions = cityOptions.length > 0 ? cityOptions : DEFAULT_CITY_OPTIONS

  const filteredCities = useMemo(() => {
    return effectiveCityOptions
      .map((entry) => ({ entry, score: getCityMatchScore(entry, cityQuery) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.localeCompare(b.entry, 'fr'))
      .map((item) => item.entry)
  }, [effectiveCityOptions, cityQuery])

  const chevronSize = variant === 'hero-glass' ? 12 : 14

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (onSearch) {
      onSearch({ type, budget, city })
      return
    }
    const params = new URLSearchParams()
    if (type !== 'all') params.set('type', type)
    if (city) params.set('q', city)
    if (budget !== 'all') params.set('budget', budget)

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
                        const Icon = option.icon
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
                    <Command
                      className="premium-search__command"
                      filter={(value, search) => (normalize(value).includes(normalize(search)) ? 1 : 0)}
                    >
                      <div className="premium-search__command-input-wrap">
                        <Search size={14} className="premium-search__search-icon" />
                        <Command.Input
                          className="premium-search__command-input"
                          placeholder="Quartier, ville…"
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
                        <Command.Empty className="premium-search__empty">Aucune ville trouvée.</Command.Empty>
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
                      {BUDGET_OPTIONS.map((option) => (
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
