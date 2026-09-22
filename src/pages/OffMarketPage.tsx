import { useState, type FormEvent } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, Gem, Lock, ShieldCheck } from 'lucide-react'
import { submitOffmarket } from '../services/offmarket'
import { usePageMeta } from '../utils/seo'

type OffMarketForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  propertyType: string
  sector: string
  budget: string
}

type RequiredOffMarketField = 'firstName' | 'lastName' | 'email' | 'phone'

const EMPTY_FORM: OffMarketForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  propertyType: '',
  sector: '',
  budget: '',
}

function validateRequiredFields(form: OffMarketForm): Partial<Record<RequiredOffMarketField, string>> {
  const errors: Partial<Record<RequiredOffMarketField, string>> = {}
  if (!form.firstName.trim()) errors.firstName = 'Le prénom est requis.'
  if (!form.lastName.trim()) errors.lastName = 'Le nom est requis.'
  if (!form.email.trim()) errors.email = "L'email est requis."
  if (!form.phone.trim()) errors.phone = 'Le téléphone est requis.'
  return errors
}

const PROPERTY_TYPES = ['Maison', 'Appartement', 'Les deux']
const SECTORS = [
  'Sainte-Foy-lès-Lyon',
  'Tassin-la-Demi-Lune',
  'Écully',
  'Francheville',
  'Craponne',
  'Oullins',
  "Tout l'Ouest Lyonnais",
]
const BUDGETS = ['< 400 000 EUR', '400 000 - 700 000 EUR', '700 000 - 1 000 000 EUR', '1 000 000 EUR+']

const FAQ = [
  {
    q: 'Le off-market est-il réservé aux biens de luxe ?',
    a: 'Non, des biens de toutes gammes peuvent être commercialisés en off-market. Tout dépend de la stratégie du vendeur et du niveau de discrétion recherché.',
  },
  {
    q: 'Combien de temps faut-il attendre ?',
    a: 'Cela dépend de vos critères. Certains clients trouvent en quelques semaines, d’autres sur un horizon plus long lorsque la recherche est très ciblée.',
  },
  {
    q: 'Y a-t-il des frais supplémentaires ?',
    a: "Non, l'inscription est gratuite et les honoraires sont identiques à une transaction classique.",
  },
  {
    q: 'Comment Hamac accède-t-il à ces biens ?',
    a: 'Notre implantation locale depuis 2021 et notre réseau de partenaires, de propriétaires et de prescripteurs nous permettent d’être informés en amont.',
  },
]

function LeadSelect({
  label,
  placeholder,
  value,
  onValueChange,
  options,
}: {
  label: string
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  options: string[]
}) {
  return (
    <label className="offmarket-field">
      <span>{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger className="offmarket-select" aria-label={label}>
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown size={14} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="offmarket-select__content" position="popper" sideOffset={8}>
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item key={option} value={option} className="offmarket-select__item">
                  <Select.ItemText>{option}</Select.ItemText>
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

export function OffMarketPage() {
  usePageMeta({
    title: 'Off-market immobilier — Hamac Investissements & Patrimoine',
    description: 'Accédez aux biens off-market de l’Ouest lyonnais avant leur publication et rejoignez le club privé Hamac.',
  })

  const [form, setForm] = useState<OffMarketForm>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RequiredOffMarketField, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const updateField = <K extends keyof OffMarketForm>(key: K, value: OffMarketForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (key in fieldErrors) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[key as RequiredOffMarketField]
        return next
      })
    }
    setSubmitSuccess(false)
    setSubmitError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    const errors = validateRequiredFields(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setSubmitSuccess(false)
      setSubmitError(null)
      return
    }

    setFieldErrors({})

    setIsSubmitting(true)
    setSubmitSuccess(false)
    setSubmitError(null)

    try {
      await submitOffmarket({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        property_type: form.propertyType || null,
        sector: form.sector || null,
        budget: form.budget || null,
      })

      setSubmitSuccess(true)
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Erreur off-market:', err)
      setSubmitError('Une erreur est survenue, veuillez réessayer ou nous contacter directement.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="offmarket-page">
      <section className="offmarket-hero">
        <img
          src="/fr/images/Biens/maison-piscine-2.webp"
          alt="Maison de prestige proposee en off-market"
          className="offmarket-hero__image"
          loading="eager"
        />
        <div className="offmarket-hero__overlay" />
        <div className="container offmarket-hero__content">
          <p className="eyebrow">ACCÈS PRIVILÉGIÉ</p>
          <h1 className="offmarket-hero__title">Le off-market — des biens avant tout le monde</h1>
          <p className="offmarket-hero__lead">
            Accédez à des propriétés exclusives qui ne sont jamais publiées sur les portails immobiliers.
          </p>
        </div>
        <div className="wave wave--hero-bottom" aria-hidden="true">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" focusable="false">
            <path className="wave__path" d="M0,58 C230,44 470,70 760,50 C1010,34 1240,62 1440,46 L1440,100 L0,100 Z" />
          </svg>
        </div>
      </section>

      <section className="section section--cream offmarket-explain">
        <div className="container offmarket-explain__grid">
          <div className="offmarket-explain__copy">
            <h2 className="section-title">Qu&apos;est-ce que le off-market ?</h2>
            <p>
              Le off-market représente environ 5 à 10% du marché immobilier français. Il s&apos;agit de biens vendus dans la
              discrétion, sans diffusion publique sur les portails traditionnels.
            </p>
            <p>
              Pour les acquéreurs, c&apos;est un vrai avantage : moins de concurrence, moins de pression, et souvent de
              meilleures marges de négociation.
            </p>
            <p>
              Chez Hamac, nous avons construit au fil des années un réseau local solide qui nous donne accès à ces
              opportunités confidentielles, souvent avant qu&apos;elles ne deviennent visibles.
            </p>
          </div>
          <aside className="offmarket-benefits">
            <article className="offmarket-benefit-card">
              <ShieldCheck size={18} />
              <h3>Moins de concurrence</h3>
              <p>Vous êtes parmi les premiers informés, loin de la guerre des offres.</p>
            </article>
            <article className="offmarket-benefit-card">
              <Gem size={18} />
              <h3>Biens rares</h3>
              <p>Des propriétés atypiques, des emplacements premium, des opportunités uniques.</p>
            </article>
            <article className="offmarket-benefit-card">
              <Lock size={18} />
              <h3>Discrétion totale</h3>
              <p>Une transaction sereine, sans visibilité publique.</p>
            </article>
          </aside>
        </div>
      </section>

      <div className="wave wave--cream-to-navy" aria-hidden="true">
        <svg viewBox="0 0 1440 72" preserveAspectRatio="none" focusable="false">
          <path className="wave__path wave__path--soft" d="M0,54 C220,42 500,62 760,46 C1020,30 1260,56 1440,40 L1440,72 L0,72 Z" />
        </svg>
      </div>

      <section className="section section--navy offmarket-steps">
        <div className="container">
          <header className="section-header section-header--on-dark">
            <h2 className="section-title">Comment ça fonctionne</h2>
          </header>
          <div className="offmarket-steps__row">
            <article className="offmarket-step">
              <span>1</span>
              <h3>Inscrivez-vous</h3>
              <p>Renseignez vos critères de recherche et vos coordonnées.</p>
            </article>
            <article className="offmarket-step">
              <span>2</span>
              <h3>Nous cherchons pour vous</h3>
              <p>Notre réseau local nous alerte dès qu&apos;un bien correspond à votre profil.</p>
            </article>
            <article className="offmarket-step">
              <span>3</span>
              <h3>Visite prioritaire</h3>
              <p>Vous êtes contacté en avant-première pour organiser une visite privée.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="section section--navy offmarket-signup">
        <div className="container section-header section-header--on-dark">
          <h2 className="section-title">Rejoindre le club off-market</h2>
          <p className="section-intro">
            Recevez nos biens exclusifs avant leur mise en ligne — c&apos;est gratuit et sans engagement.
          </p>
        </div>
        <div className="container">
          <form className="offmarket-signup__card" onSubmit={submit}>
            <div className="offmarket-signup__grid">
              <label className="offmarket-field">
                <span>Prénom</span>
                <input
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  aria-describedby={fieldErrors.firstName ? 'offmarket-firstName-error' : undefined}
                />
                {fieldErrors.firstName ? (
                  <span id="offmarket-firstName-error" className="offmarket-field__error" role="alert">
                    {fieldErrors.firstName}
                  </span>
                ) : null}
              </label>
              <label className="offmarket-field">
                <span>Nom</span>
                <input
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  aria-describedby={fieldErrors.lastName ? 'offmarket-lastName-error' : undefined}
                />
                {fieldErrors.lastName ? (
                  <span id="offmarket-lastName-error" className="offmarket-field__error" role="alert">
                    {fieldErrors.lastName}
                  </span>
                ) : null}
              </label>
              <label className="offmarket-field">
                <span>Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'offmarket-email-error' : undefined}
                />
                {fieldErrors.email ? (
                  <span id="offmarket-email-error" className="offmarket-field__error" role="alert">
                    {fieldErrors.email}
                  </span>
                ) : null}
              </label>
              <label className="offmarket-field">
                <span>Téléphone</span>
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'offmarket-phone-error' : undefined}
                />
                {fieldErrors.phone ? (
                  <span id="offmarket-phone-error" className="offmarket-field__error" role="alert">
                    {fieldErrors.phone}
                  </span>
                ) : null}
              </label>
              <LeadSelect
                label="Type de bien recherché"
                placeholder="Sélectionnez"
                value={form.propertyType}
                onValueChange={(value) => updateField('propertyType', value)}
                options={PROPERTY_TYPES}
              />
              <LeadSelect
                label="Secteur privilégié"
                placeholder="Sélectionnez"
                value={form.sector}
                onValueChange={(value) => updateField('sector', value)}
                options={SECTORS}
              />
              <LeadSelect
                label="Budget"
                placeholder="Sélectionnez"
                value={form.budget}
                onValueChange={(value) => updateField('budget', value)}
                options={BUDGETS}
              />
            </div>
            <div className="offmarket-signup__actions">
              {submitSuccess ? (
                <p className="offmarket-feedback offmarket-feedback--success" role="status">
                  Votre demande a bien été enregistrée. Nous vous contacterons sous 48h.
                </p>
              ) : null}
              {submitError ? (
                <p className="offmarket-feedback offmarket-feedback--error" role="alert">
                  {submitError}
                </p>
              ) : null}
              <button className="btn btn--gold" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Envoi en cours…' : 'Rejoindre le club'}
              </button>
              <p>Vos données sont protégées. Vous pouvez vous désinscrire à tout moment.</p>
            </div>
          </form>
        </div>
      </section>

      <section className="section section--cream offmarket-testimonial">
        <div className="container">
          <blockquote className="selling-quote">
            <p>
              « Grâce au réseau off-market de Hamac, nous avons trouvé notre maison à Sainte-Foy avant même sa mise en
              vente. Aucune concurrence, un prix juste, et un accompagnement irréprochable. »
            </p>
            <footer>— Famille D., Achat off-market à Sainte-Foy-lès-Lyon.</footer>
          </blockquote>
        </div>
      </section>

      <section className="section section--cream offmarket-faq">
        <div className="container">
          <header className="section-header">
            <h2 className="section-title">Questions fréquentes</h2>
          </header>
          <div className="offmarket-faq__list">
            {FAQ.map((item, index) => {
              const isOpen = openFaq === index
              return (
                <article key={item.q} className={`offmarket-faq__item ${isOpen ? 'is-open' : ''}`}>
                  <button type="button" onClick={() => setOpenFaq((current) => (current === index ? null : index))}>
                    <span>{item.q}</span>
                    <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen ? <p>{item.a}</p> : null}
                </article>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}
