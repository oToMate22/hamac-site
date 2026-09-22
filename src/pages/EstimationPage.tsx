import { useMemo, useState, type FormEvent } from 'react'
import * as Select from '@radix-ui/react-select'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, ChevronDown, ShieldCheck, Clock3, MapPinHouse, Sparkles } from 'lucide-react'
import { CitySearchField } from '../components/CitySearchField'
import { EstimationTypeIllustration } from '../components/EstimationTypeIllustration'
import type { PropertyType } from '../data/properties'
import { submitEstimation } from '../services/estimations'
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

const TYPE_OPTIONS: Array<{
  value: PropertyType
  label: string
  hint: string
  illustration: 'maison' | 'appartement' | 'terrain'
}> = [
  {
    value: 'maison',
    label: 'Maison',
    hint: 'Villa, pavillon, propriété',
    illustration: 'maison',
  },
  {
    value: 'appartement',
    label: 'Appartement',
    hint: 'T2, T3, duplex, loft',
    illustration: 'appartement',
  },
  {
    value: 'terrain',
    label: 'Terrain',
    hint: 'Constructible ou viabilisé',
    illustration: 'terrain',
  },
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
    description: "Ces informations nous permettent d'affiner votre estimation.",
    hint: 'Renseignez la surface habitable pour continuer.',
  },
  {
    id: 3,
    label: 'Contact',
    title: 'Recevez votre estimation',
    description: 'Un expert Hamac vous recontacte sous 24 h.',
    hint: 'Complétez vos coordonnées pour envoyer la demande.',
  },
] as const

function getTypeLabel(type: PropertyType | ''): string {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Votre bien'
}

function getStepEncouragement(step: number, form: EstimationForm): string | null {
  if (step === 1) {
    if (form.type && form.city) return 'Parfait — votre bien est identifié. Passez à l’étape suivante.'
    if (form.type) return 'Très bien. Indiquez maintenant la commune pour personnaliser l’estimation.'
    return 'Commencez par sélectionner le type de bien à estimer.'
  }
  if (step === 2) {
    if (form.surface) return 'Encore quelques détails optionnels, puis nous vous recontactons sous 24 h.'
    return 'La surface habitable suffit pour continuer — le reste affinera l’analyse.'
  }
  return null
}

function computeFormProgress(step: number, form: EstimationForm): number {
  const step1 = (form.type ? 0.55 : 0) + (form.city ? 0.45 : 0)
  const step2 =
    (form.surface ? 0.7 : 0) +
    (form.rooms ? 0.1 : 0) +
    (form.bedrooms ? 0.1 : 0) +
    (form.type === 'maison' && form.land ? 0.1 : 0)
  const contactFields = [form.lastName, form.firstName, form.email, form.phone]
  const step3 = contactFields.filter(Boolean).length / contactFields.length

  if (step === 1) return Math.round(step1 * 33.3)
  if (step === 2) return Math.round(33.3 + step2 * 33.3)
  return Math.round(66.6 + step3 * 33.4)
}

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const isLastStep = step === 3
  const currentStep = STEPS[step - 1]
  const continueHint = useMemo(() => {
    return currentStep.hint
  }, [currentStep.hint])
  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(form.type && form.city)
    if (step === 2) return Boolean(form.surface)
    return Boolean(form.lastName && form.firstName && form.email && form.phone)
  }, [form, step])

  const formProgress = useMemo(() => computeFormProgress(step, form), [form, step])
  const encouragement = useMemo(() => getStepEncouragement(step, form), [form, step])
  const livePreview = useMemo(() => {
    if (!form.type && !form.city) return null
    const typeLabel = form.type ? getTypeLabel(form.type) : 'Votre bien'
    if (form.city) return `${typeLabel} · ${form.city}`
    return typeLabel
  }, [form.city, form.type])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isLastStep) {
      setSubmitError(null)
      setSubmitSuccess(false)
      if (canContinue) setStep((value) => Math.min(3, value + 1))
      return
    }
    if (!canContinue || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      await submitEstimation({
        property_type: form.type,
        city: form.city.trim(),
        surface_habitable: form.surface ? Number.parseInt(form.surface, 10) : null,
        nombre_pieces: form.rooms ? Number.parseInt(form.rooms, 10) : null,
        nombre_chambres: form.bedrooms ? Number.parseInt(form.bedrooms, 10) : null,
        surface_terrain: form.land ? Number.parseInt(form.land, 10) : null,
        nom: form.lastName.trim(),
        prenom: form.firstName.trim(),
        email: form.email.trim(),
        telephone: form.phone.trim(),
        message: form.message.trim() || null,
      })

      setSubmitSuccess(true)
      setForm({
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
      setStep(1)
    } catch (error) {
      console.error('Erreur estimation:', error)
      setSubmitError('Une erreur est survenue. Merci de réessayer ou de nous contacter par téléphone.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="estimation-page">
      <section className="estimation-hero">
        <img
          src="/fr/images/Biens/maison-jardin.webp"
          alt="Maison avec jardin dans l'Ouest lyonnais"
          className="estimation-hero__image"
          loading="eager"
        />
        <div className="estimation-hero__overlay" />
        <div className="container estimation-hero__content">
          <p className="eyebrow">ESTIMATION GRATUITE</p>
          <h1 className="estimation-hero__title">Connaître la valeur de votre bien</h1>
          <p className="estimation-hero__lead">
            Recevez une estimation précise et argumentée sous 24 h, réalisée par un expert de votre quartier.
          </p>
        </div>
        <div className="wave wave--hero-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
            <path className="wave__path" d="M0,58 C230,44 470,70 760,50 C1010,34 1240,62 1440,46 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className="estimation-highlights" aria-label="Avantages de l'estimation Hamac">
        <div className="container estimation-highlights__grid">
          <div className="estimation-highlights__item">
            <ShieldCheck size={20} aria-hidden />
            <span>Gratuite et sans engagement</span>
          </div>
          <div className="estimation-highlights__item">
            <Clock3 size={20} aria-hidden />
            <span>Réponse sous 24 h</span>
          </div>
          <div className="estimation-highlights__item">
            <MapPinHouse size={20} aria-hidden />
            <span>Expertise locale de l&apos;Ouest Lyonnais</span>
          </div>
        </div>
      </section>

      <section className="section section--cream estimation-body">
        <div className="container estimation-layout">
        <div className="estimation-form-card">
          <div className="estimation-progress-bar" aria-hidden="true">
            <span className="estimation-progress-bar__fill" style={{ width: `${formProgress}%` }} />
          </div>
          <p className="estimation-progress-bar__label">
            <Sparkles size={14} aria-hidden />
            <span>{formProgress}% complété · environ 2 min</span>
          </p>

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

          <AnimatePresence mode="wait">
            {livePreview ? (
              <motion.div
                key={livePreview}
                className="estimation-live-preview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <MapPinHouse size={16} aria-hidden />
                <span>{livePreview}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <form onSubmit={submit} className="estimation-form">
            <header className="estimation-step-header">
              <p className="estimation-step-header__eyebrow">
                Étape {step} sur {STEPS.length}
              </p>
              <h2 className="estimation-step-header__title">{currentStep.title}</h2>
              <p className="estimation-step-header__desc">{currentStep.description}</p>
              {encouragement ? (
                <p className="estimation-step-header__encouragement">{encouragement}</p>
              ) : null}
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className="estimation-step-panel"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
            {step === 1 ? (
              <>
                <div className="estimation-type-grid">
                  {TYPE_OPTIONS.map((option) => {
                    const isSelected = form.type === option.value
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        className={`estimation-type-card ${isSelected ? 'is-active' : ''}`}
                        onClick={() => setForm((current) => ({ ...current, type: option.value }))}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.98 }}
                        layout
                      >
                        <span className="estimation-type-card__illustration" aria-hidden>
                          <EstimationTypeIllustration kind={option.illustration} />
                        </span>
                        <span className="estimation-type-card__body">
                          <strong>{option.label}</strong>
                          <small>{option.hint}</small>
                        </span>
                        {isSelected ? (
                          <span className="estimation-type-card__check" aria-hidden>
                            <Check size={14} />
                          </span>
                        ) : null}
                      </motion.button>
                    )
                  })}
                </div>
                <AnimatePresence>
                  {form.type ? (
                    <motion.div
                      className="estimation-city-reveal"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="estimation-city-reveal__prompt">Où se situe votre bien ?</p>
                      <CitySearchField
                        label="Ville"
                        value={form.city}
                        onValueChange={(value) => setForm((current) => ({ ...current, city: value }))}
                        placeholder="Rechercher une commune"
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
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
              </motion.div>
            </AnimatePresence>

            <div className="estimation-actions">
              {step > 1 ? (
                <button type="button" className="estimation-back" onClick={() => setStep((value) => Math.max(1, value - 1))}>
                  Retour
                </button>
              ) : (
                <span className="estimation-actions__spacer" aria-hidden />
              )}
              <button
                type="submit"
                className={`estimation-cta ${canContinue ? 'is-ready' : ''}`}
                disabled={!canContinue || isSubmitting}
              >
                <span>
                  {isSubmitting ? 'Envoi en cours...' : isLastStep ? 'Recevoir mon estimation' : 'Continuer'}
                </span>
                <ArrowRight size={20} aria-hidden />
              </button>
            </div>
            {submitSuccess ? (
              <p className="estimation-feedback estimation-feedback--success" role="status">
                Votre demande d&apos;estimation a bien été envoyée. Nous vous recontactons sous 24 h.
              </p>
            ) : null}
            {submitError ? (
              <p className="estimation-feedback estimation-feedback--error" role="alert">
                {submitError}
              </p>
            ) : null}
            {!canContinue && !submitSuccess ? (
              <p className="estimation-cta-hint" role="status">
                {continueHint}
              </p>
            ) : null}
          </form>
        </div>

        <aside className="estimation-reassurance">
          <figure className="estimation-reassurance__photo">
            <img
              src="/fr/images/Biens/appartement-interieur-1.webp"
              alt="Intérieur lumineux d'un bien immobilier dans l'Ouest lyonnais"
              loading="lazy"
            />
            <figcaption>Un regard expert sur chaque typologie de bien</figcaption>
          </figure>

          <div className="estimation-reassurance__content">
            <h2>Pourquoi estimer avec Hamac ?</h2>
            <ul>
              <li><ShieldCheck size={18} /> Estimation gratuite et sans engagement</li>
              <li><Clock3 size={18} /> Réponse sous 24 h par un expert local</li>
              <li><MapPinHouse size={18} /> Connaissance précise des prix de l&apos;Ouest Lyonnais</li>
            </ul>

            <article className="estimation-testimonial">
              <p>
                « Estimation claire, argumentée et très juste par rapport au marché. Nous avons vendu sereinement, au bon prix. »
              </p>
              <strong>Claire &amp; Marc D. — Sainte-Foy-lès-Lyon</strong>
            </article>

            <p className="estimation-privacy">Vos données sont protégées et ne seront jamais partagées.</p>
          </div>
        </aside>
        </div>
      </section>
    </main>
  )
}