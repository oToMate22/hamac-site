import { useEffect, useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Command } from 'cmdk'
import { CITIES } from '../data/properties'
import { useFrenchCommuneSearch } from '../hooks/useFrenchCommuneSearch'
import { formatCommuneLabel } from '../utils/frenchCommunes'

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

type CitySearchFieldProps = {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

export function CitySearchField({
  label,
  value,
  onValueChange,
  placeholder = 'Rechercher une ville',
}: CitySearchFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const { results, loading } = useFrenchCommuneSearch(query, open, 14)

  useEffect(() => {
    setQuery(value)
  }, [value])

  const localMatches = useMemo(() => {
    const trimmed = normalize(query)
    if (!trimmed) return CITIES
    return CITIES.filter((entry) => normalize(entry).includes(trimmed))
  }, [query])

  const selectCity = (city: string) => {
    onValueChange(city)
    setQuery(city)
    setOpen(false)
  }

  const clearCity = () => {
    onValueChange('')
    setQuery('')
  }

  const customQuery = query.trim()
  const showCustomOption = customQuery.length >= 2

  return (
    <label className="estimation-field estimation-city-field">
      <span>{label}</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="estimation-city-field__trigger" aria-label={label}>
            <Search size={14} aria-hidden="true" />
            <span className={value ? '' : 'estimation-city-field__placeholder'}>{value || placeholder}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="estimation-city-field__popover" sideOffset={8} align="start">
            <Command className="estimation-city-field__command" shouldFilter={false}>
              <div className="estimation-city-field__input-wrap">
                <Search size={14} aria-hidden="true" />
                <Command.Input
                  className="estimation-city-field__input"
                  placeholder="Ex. Lyon, Paris, Bordeaux…"
                  value={query}
                  onValueChange={setQuery}
                />
                {value ? (
                  <button type="button" className="estimation-city-field__clear" aria-label="Effacer la ville" onClick={clearCity}>
                    <X size={14} />
                  </button>
                ) : null}
              </div>
              <Command.List className="estimation-city-field__list">
                {customQuery.length < 2 ? (
                  <>
                    <p className="estimation-city-field__hint">Communes de l&apos;Ouest Lyonnais</p>
                    {localMatches.map((entry) => (
                      <Command.Item
                        key={entry}
                        value={entry}
                        className="estimation-city-field__item"
                        onSelect={() => selectCity(entry)}
                      >
                        <span>{entry}</span>
                        {value === entry ? <Check size={14} /> : null}
                      </Command.Item>
                    ))}
                    <p className="estimation-city-field__hint">Saisissez au moins 2 lettres pour toute commune de France</p>
                  </>
                ) : null}

                {loading ? <p className="estimation-city-field__status">Recherche en cours…</p> : null}

                {!loading && customQuery.length >= 2
                  ? results.map((entry) => (
                      <Command.Item
                        key={entry.code}
                        value={`${entry.name}-${entry.code}`}
                        className="estimation-city-field__item"
                        onSelect={() => selectCity(entry.name)}
                      >
                        <span>{formatCommuneLabel(entry)}</span>
                        {value === entry.name ? <Check size={14} /> : null}
                      </Command.Item>
                    ))
                  : null}

                {!loading && customQuery.length >= 2 && results.length === 0 ? (
                  <Command.Empty className="estimation-city-field__empty">Aucune commune trouvée.</Command.Empty>
                ) : null}

                {showCustomOption ? (
                  <Command.Item
                    value={`custom-${customQuery}`}
                    className="estimation-city-field__item estimation-city-field__item--custom"
                    onSelect={() => selectCity(customQuery)}
                  >
                    <span>Utiliser « {customQuery} »</span>
                  </Command.Item>
                ) : null}
              </Command.List>
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </label>
  )
}
