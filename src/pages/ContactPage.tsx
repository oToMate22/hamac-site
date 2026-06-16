import { useEffect, useState, type FormEvent } from 'react'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, Clock3, Mail, MapPin, Phone } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { SocialLinks } from '../components/SocialLinks'
import { submitLead } from '@/services/leads'
import { usePageMeta } from '../utils/seo'

type ContactForm = {
  firstName: string
  lastName: string
  email: string
  phone: string
  project: string
  message: string
}

const PROJECT_OPTIONS = ['Acheter', 'Vendre', 'Estimer mon bien', 'Investir', 'Autre']
const ESTIMATION_PROJECT = 'Estimer mon bien'

export function ContactPage() {
  const [searchParams] = useSearchParams()
  usePageMeta({
    title: 'Contact — Hamac Investissements & Patrimoine',
    description: 'Rencontrez l’équipe Hamac à Sainte-Foy-lès-Lyon ou envoyez-nous votre demande. Réponse sous 24h.',
  })

  const [form, setForm] = useState<ContactForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    project: '',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const projet = searchParams.get('projet')
    if (projet !== 'estimer' && projet !== 'estimation') return

    setForm((current) => ({
      ...current,
      project: ESTIMATION_PROJECT,
      message:
        current.message.trim() === ''
          ? 'Je souhaiterais obtenir une estimation de mon bien.'
          : current.message,
    }))
  }, [searchParams])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    const nom = `${form.firstName} ${form.lastName}`.trim()
    const messageWithProject = form.project
      ? `[Projet: ${form.project}] ${form.message}`.trim()
      : form.message.trim()

    try {
      await submitLead({
        nom,
        email: form.email.trim(),
        telephone: form.phone.trim(),
        message: messageWithProject || null,
        type_contact: 'contact',
      })
    } catch (error) {
      console.error('Erreur:', error)
      setFeedback({
        type: 'error',
        text: 'Une erreur est survenue. Merci de réessayer ou de nous contacter par téléphone.',
      })
      setIsSubmitting(false)
      return
    }

    setFeedback({ type: 'success', text: 'Votre demande a bien été envoyée. Nous revenons vers vous rapidement.' })
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      project: '',
      message: '',
    })
    setIsSubmitting(false)
  }

  return (
    <main className="section section--cream contact-page">
      <section className="container contact-hero">
        <h1 className="section-title">Nous rencontrer</h1>
        <p className="contact-hero__lead">Passez nous voir a l&apos;agence ou ecrivez-nous. Nous repondons sous 24h.</p>
      </section>

      <section className="container contact-layout">
        <div>
          <div className="contact-cards">
            <article className="contact-info-card">
              <MapPin size={18} />
              <div>
                <h2>Adresse de l&apos;agence</h2>
                <p>19 Boulevard Baron du Marais, 69110 Sainte-Foy-les-Lyon</p>
              </div>
            </article>
            <article className="contact-info-card">
              <Phone size={18} />
              <div>
                <h2>Telephone</h2>
                <p><a href="tel:+33478850827">04 78 85 08 27</a></p>
              </div>
            </article>
            <article className="contact-info-card">
              <Mail size={18} />
              <div>
                <h2>Email</h2>
                <p><a href="mailto:agence@hamacpatrimoine.com">agence@hamacpatrimoine.com</a></p>
              </div>
            </article>
            <article className="contact-info-card">
              <Clock3 size={18} />
              <div>
                <h2>Horaires</h2>
                <p>Lundi au vendredi : 9h-19h, Samedi : 9h-13h</p>
              </div>
            </article>
          </div>

          <iframe
            title="Carte Hamac Patrimoine"
            className="contact-map"
            loading="lazy"
            src="https://maps.google.com/maps?q=45.736,4.797&z=15&output=embed"
          />

          <p className="contact-socials__label">Suivez-nous</p>
          <SocialLinks className="contact-socials" variant="light" />
        </div>

        <aside className="contact-form-card">
          <form className="contact-form" onSubmit={submit}>
            <div className="contact-form__grid">
              <label>
                <span>Prenom</span>
                <input value={form.firstName} onChange={(e) => setForm((c) => ({ ...c, firstName: e.target.value }))} required />
              </label>
              <label>
                <span>Nom</span>
                <input value={form.lastName} onChange={(e) => setForm((c) => ({ ...c, lastName: e.target.value }))} required />
              </label>
            </div>

            <label>
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))} required />
            </label>
            <label>
              <span>Telephone</span>
              <input value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} required />
            </label>

            <label>
              <span>Votre projet</span>
              <Select.Root value={form.project} onValueChange={(value) => setForm((c) => ({ ...c, project: value }))}>
                <Select.Trigger className="contact-select" aria-label="Votre projet">
                  <Select.Value placeholder="Selectionnez un projet" />
                  <Select.Icon>
                    <ChevronDown size={14} />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content className="contact-select__content" position="popper" sideOffset={8}>
                    <Select.Viewport>
                      {PROJECT_OPTIONS.map((option) => (
                        <Select.Item key={option} value={option} className="contact-select__item">
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

            <label>
              <span>Message</span>
              <textarea rows={6} value={form.message} onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))} />
            </label>

            {feedback ? (
              <p role="status" aria-live="polite" style={{ margin: 0, color: feedback.type === 'success' ? '#2f6f44' : '#9b2f2f' }}>
                {feedback.text}
              </p>
            ) : null}

            <button type="submit" className="search-card__submit" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi en cours...' : 'Envoyer'}
            </button>
          </form>
        </aside>
      </section>
    </main>
  )
}
