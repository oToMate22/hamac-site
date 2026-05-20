import { useMemo, useState, type FormEvent } from 'react'
import * as Select from '@radix-ui/react-select'
import { ArrowRight, Check, ChevronDown, Home, Building2, LandPlot, ShieldCheck, Clock3, MapPinHouse } from 'lucide-react'
import { CitySearchField } from '../components/CitySearchField'
import type { PropertyType } from '../data/properties'
import { usePageMeta } from '../utils/seo'

type EstimationForm = {
  type: PropertyType | ''
  city: string
  surface: string
  rooms: string
  bedrooms: string
  land: string
  lastName: string
  firstName: string
  email: string
  phone: string
  message: string
}

const TYPE_OPTIONS: Array<{ value: PropertyType; label: string; icon: typeof Home }> = [
  { value: 'maison', label: 'Maison', icon: Home },
  { value: 'appartement', label: 'Appartement', icon: Building2 },
  { value: 'terrain', label: 'Terrain', icon: LandPlot },
]

const STEPS = [
  {
    id: 1,
    label: 'Bien',
    title: 'Quel bien souhaitez-vous estimer ?',
    description: 'Choisissez le type de bien et indiquez sa commune.',
    hint: 'Sélectionnez un type de bien et une ville pour continuer.',
  },
  {
    id: 2,
    label: 'Détails',
    title: 'Caractéristiques du bien',
    description: 'Ces informations nous permettent d’affiner votre estimation.',
    hint: 'Renseignez la surface et le nombre de pièces pour continuer.',
  },
  {
    id: 3,
    label: 'Contact',
    title: 'Recevez votre estimation',
    description: 'Un expert Hamac vous recontacte sous 24 h.',
    hint: 'Complétez vos coordonnées pour envoyer la demande.',
  },
] as const

function FieldSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder: string
}) {
  return (
    <label className="estimation-field">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="estimation-select" aria-label={label}>
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="estimation-select__content" position="popper" sideOffset={8}>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className="estimation-select__item">
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

export function EstimationPage() {
  usePageMeta({
    title: 'Estimation immobilière gratuite — Hamac Investissements & Patrimoine',
    description: 'Obtenez une estimation précise et argumentée de votre bien sous 24h avec un expert Hamac de votre quartier.',
  })

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<EstimationForm>({
    type: '',
    city: '',
    surface: '',
    rooms: '',
    bedrooms: '',
    land: '',
    lastName: '',
    firstName: '',
    email: '',
    phone: '',
    message: '',
  })

  const isLastStep = step === 3
  const currentStep = STEPS[step - 1]
  const continueHint = useMemo(() => {
    if (step === 2 && form.type === 'maison' && form.surface && form.rooms && form.bedrooms && !form.land) {
      return 'Indiquez la surface du terrain pour continuer.'
    }
    return currentStep.hint
  }, [currentStep.hint, form.bedrooms, form.land, form.rooms, form.surface, form.type, step])
  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(form.type && form.city)
    if (step === 2) return Boolean(form.surface && form.rooms && form.bedrooms && (form.type !== 'maison' || form.land))
    return Boolean(form.lastName && form.firstName && form.email && form.phone)
  }, [form, step])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLastStep) {
      if (canContinue) setStep((value) => Math.min(3, value + 1))
      return
    }
    if (!canContinue) return
    console.log('estimation_request', form)
  }

  return (
    <main className="section section--cream estimation-page">
      <section className="estimation-hero">
        <div className="container">
          <h1 className="section-title estimation-hero__title">Connaître la valeur de votre bien</h1>
          <p className="estimation-hero__lead">
            Recevez une estimation précise et argumentée sous 24 h, réalisée par un expert de votre quartier.
          </p>
        </div>
      </section>

      <section className="container estimation-layout">
        <div className="estimation-form-card">
          <div className="estimation-progress" aria-label="Progression du formulaire">
            {STEPS.map((entry) => {
              const isActive = step === entry.id
              const isDone = step > entry.id
              return (
                <div
                  key={entry.id}
                  className={`estimation-progress__item ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span>{isDone ? <Check size={14} aria-hidden /> : entry.id}</span>
                  <p>{entry.label}</p>
                </div>
              )
            })}
          </div>

          <form onSubmit={submit} className="estimation-form">
            <header className="estimation-step-header">
              <p className="estimation-step-header__eyebrow">
                Étape {step} sur {STEPS.length}
              </p>
              <h2 className="estimation-step-header__title">{currentStep.title}</h2>
              <p className="estimation-step-header__desc">{currentStep.description}</p>
            </header>

            {step === 1 ? (
              <>
                <div className="estimation-type-grid">
                  {TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`estimation-type-card ${form.type === option.value ? 'is-active' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, type: option.value }))}
                      >
                        <Icon size={18} />
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
                <CitySearchField
                  label="Ville"
                  value={form.city}
                  onValueChange={(value) => setForm((current) => ({ ...current, city: value }))}
                  placeholder="Rechercher une commune"
                />
              </>
            ) : null}

            {step === 2 ? (
              <div className="estimation-grid">
                <label className="estimation-field">
                  <span>Surface habitable</span>
                  <div className="estimation-input-wrap">
                    <input
                      type="number"
                      min={1}
                      value={form.surface}
                      onChange={(event) => setForm((current) => ({ ...current, surface: event.target.value }))}
                      placeholder="Ex: 120"
                    />
                    <small>m²</small>
                  </div>
                </label>
                <FieldSelect
                  label="Nombre de pieces"
                  value={form.rooms}
                  onValueChange={(value) => setForm((current) => ({ ...current, rooms: value }))}
                  options={[1, 2, 3, 4, 5, 6, 7].map((value) => ({ value: String(value), label: String(value) }))}
                  placeholder="Pieces"
                />
                <FieldSelect
                  label="Nombre de chambres"
                  value={form.bedrooms}
                  onValueChange={(value) => setForm((current) => ({ ...current, bedrooms: value }))}
                  options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: value === 5 ? '4+' : String(value) }))}
                  placeholder="Chambres"
                />
                {form.type === 'maison' ? (
                  <label className="estimation-field">
                    <span>Terrain</span>
                    <div className="estimation-input-wrap">
                      <input
                        type="number"
                        min={1}
                        value={form.land}
                        onChange={(event) => setForm((current) => ({ ...current, land: event.target.value }))}
                        placeholder="Ex: 600"
                      />
                      <small>m²</small>
                    </div>
                  </label>
                ) : null}
              </div>
            ) : null}

            {step === 3 ? (
              <div className="estimation-grid">
                <label className="estimation-field">
                  <span>Nom</span>
                  <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
                </label>
                <label className="estimation-field">
                  <span>Prenom</span>
                  <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
                </label>
                <label className="estimation-field">
                  <span>Email</span>
                  <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label className="estimation-field">
                  <span>Telephone</span>
                  <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </label>
                <label className="estimation-field estimation-field--full">
                  <span>Message optionnel</span>
                  <textarea rows={4} value={form.message} onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))} />
                </label>
              </div>
            ) : null}

            <div className="estimation-actions">
              {step > 1 ? (
                <button type="button" className="estimation-back" onClick={() => setStep((value) => Math.max(1, value - 1))}>
                  Retour
                </button>
              ) : (
                <span className="estimation-actions__spacer" aria-hidden />
              )}
              <button type="submit" className="estimation-cta" disabled={!canContinue}>
                <span>{isLastStep ? 'Recevoir mon estimation' : 'Continuer'}</span>
                <ArrowRight size={20} aria-hidden />
              </button>
            </div>
            {!canContinue ? (
              <p className="estimation-cta-hint" role="status">
                {continueHint}
              </p>
            ) : null}
          </form>
        </div>

        <aside className="estimation-reassurance">
          <h2>Pourquoi estimer avec Hamac ?</h2>
          <ul>
            <li><ShieldCheck size={18} /> Estimation gratuite et sans engagement</li>
            <li><Clock3 size={18} /> Reponse sous 24h par un expert local</li>
            <li><MapPinHouse size={18} /> Connaissance precise des prix de l&apos;Ouest Lyonnais</li>
          </ul>

          <article className="estimation-testimonial">
            <p>
              « Estimation claire, argumentee et tres juste par rapport au marche. Nous avons vendu sereinement, au bon prix. »
            </p>
            <strong>Claire &amp; Marc D. — Sainte-Foy-les-Lyon</strong>
          </article>

          <p className="estimation-privacy">Vos donnees sont protegees et ne seront jamais partagees.</p>
        </aside>
      </section>
    </main>
  )
}
