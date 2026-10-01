import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { BLOG_CATEGORIES, BLOG_POSTS, getBlogPostBySlug, type BlogPost } from '../data/blogPosts'
import { blogPostingJsonLd } from '../seo/jsonld'
import { usePageMeta } from '../utils/seo'

const AUTHOR_DATA: Record<string, { role: string; photo: string; bio: string }> = {
  "L'équipe Hamac": {
    role: 'Agence immobilière',
    photo: '/fr/images/Logo/logo-hamac.webp',
    bio: "L'équipe Hamac décrypte le marché résidentiel de l'Ouest lyonnais pour accompagner vendeurs et acquéreurs avec une lecture fine des micro-secteurs.",
  },
  'Romain Monneri-Fons': {
    role: 'Agent commercial indépendant',
    photo: '/fr/images/team/romain.webp',
    bio: 'Romain conseille les primo-accédants et structure des parcours d’achat clairs, efficaces et sécurisés.',
  },
  'Élodie Renard': {
    role: 'Agent commercial indépendant',
    photo: '/fr/images/team/elodie-renard.webp',
    bio: 'Élodie accompagne les familles dans leurs projets de vie, avec une attention particulière aux quartiers et aux écoles.',
  },
  'Samuel Ribes': {
    role: 'Agent commercial indépendant',
    photo: '/fr/images/team/samuel.webp',
    bio: 'Samuel accompagne les investisseurs avec une approche patrimoniale, orientée rendement durable et valorisation.',
  },
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))

function BlogCard({ post, featured = false }: { post: BlogPost; featured?: boolean }) {
  return (
    <article className={`blog-card ${featured ? 'blog-card--featured' : ''}`}>
      <Link to={`/blog/${post.slug}`} className="blog-card__link">
        <div className="blog-card__image-wrap">
          <img src={post.coverImage} alt={`Photo de couverture: ${post.title}`} loading={featured ? 'eager' : 'lazy'} />
        </div>
        <div className="blog-card__body">
          <span className="blog-card__badge">{post.category}</span>
          <h3>{post.title}</h3>
          <p>{post.excerpt}</p>
          <small>{post.author} · {formatDate(post.publishedDate)} · {post.readTime}</small>
        </div>
      </Link>
    </article>
  )
}

export const BlogPage = () => {
  usePageMeta({
    title: 'Journal Hamac — Hamac Investissements & Patrimoine',
    description: "Analyses du marché, guides pratiques et vie locale dans l'Ouest Lyonnais.",
  })

  const [activeCategory, setActiveCategory] = useState<(typeof BLOG_CATEGORIES)[number]>('Tout')

  const posts = useMemo(() => {
    if (activeCategory === 'Tout') return BLOG_POSTS
    return BLOG_POSTS.filter((entry) => entry.category === activeCategory)
  }, [activeCategory])

  const featured = posts[0]
  const gridPosts = posts.slice(1)

  return (
    <main className="section section--cream blog-page">
      <section className="container blog-hero">
        <header className="section-header">
          <h1 className="section-title">Journal Hamac</h1>
          <p className="section-intro">Analyses du marché, guides pratiques et vie locale dans l&apos;Ouest Lyonnais.</p>
        </header>
      </section>

      <section className="container blog-filters" aria-label="Filtrer les articles par catégorie">
        {BLOG_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={`blog-filter-chip ${activeCategory === category ? 'is-active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </section>

      <section className="container blog-listing">
        {featured ? <BlogCard post={featured} featured /> : null}
        <div className="blog-grid">
          {gridPosts.map((post) => <BlogCard key={post.slug} post={post} />)}
        </div>
      </section>
    </main>
  )
}

export function BlogPostPage() {
  const { slug = '' } = useParams()
  const post = getBlogPostBySlug(slug)

  usePageMeta({
    title: post ? `${post.title} — Hamac Investissements & Patrimoine` : 'Article — Hamac Investissements & Patrimoine',
    description: post ? post.excerpt : "Découvrez les analyses et guides du Journal Hamac sur l'Ouest lyonnais.",
    ogType: 'article',
    ogImage: post?.coverImage,
    jsonLd: post ? [{ id: 'ld-article', data: blogPostingJsonLd(post) }] : undefined,
  })

  if (!post) return <Navigate to="/blog" replace />

  const author = AUTHOR_DATA[post.author] ?? {
    role: 'Agent commercial indépendant',
    photo: '/fr/images/team/anthony.webp',
    bio: 'Expert immobilier de proximité dans l’Ouest lyonnais.',
  }

  const relatedByCategory = BLOG_POSTS.filter((entry) => entry.slug !== post.slug && entry.category === post.category)
  const fallback = BLOG_POSTS.filter((entry) => entry.slug !== post.slug && entry.category !== post.category)
  const related = [...relatedByCategory, ...fallback].slice(0, 3)

  return (
    <main className="section section--cream blog-detail">
      <section className="container blog-detail__top">
        <p className="detail-back"><Link to="/blog">← Retour au journal</Link></p>
        <header className="blog-detail__header">
          <span className="blog-card__badge">{post.category}</span>
          <h1>{post.title}</h1>
          <p>{post.author} · {formatDate(post.publishedDate)} · {post.readTime}</p>
        </header>
      </section>

      <section className="container blog-detail__cover">
        <img src={post.coverImage} alt={`Photo de couverture de l'article ${post.title}`} loading="eager" />
      </section>

      <article className="container blog-article">
        <div className="blog-article__prose">
          {post.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </article>

      <section className="container blog-author">
        <article className="blog-author__card">
          <img src={author.photo} alt={`Portrait de ${post.author}`} loading="lazy" />
          <div>
            <h3>{post.author}</h3>
            <p className="blog-author__role">{author.role}</p>
            <p>{author.bio}</p>
            <p><Link to="/agence" className="link-gold">Découvrir l&apos;équipe <span aria-hidden="true">→</span></Link></p>
          </div>
        </article>
      </section>

      <section className="container blog-related">
        <header className="section-header">
          <h2 className="section-title">Articles similaires</h2>
        </header>
        <div className="blog-grid">
          {related.map((entry) => <BlogCard key={entry.slug} post={entry} />)}
        </div>
      </section>
    </main>
  )
}
