export function PagePlaceholder({ title }: { title: string }) {
  return (
    <main className="page-placeholder">
      <div className="container page-placeholder__inner">
        <p className="eyebrow">Hamac</p>
        <h1 className="section-title">{title}</h1>
      </div>
    </main>
  )
}
