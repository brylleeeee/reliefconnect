

/** Page title, subtitle and, optionally, the page's main action button on the right. */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="rc-page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="rc-page-actions">{actions}</div> : (
        <div className="rc-lgu-tag">
          <span className="rc-flag"><i /><i /><i /></span>
          LGU URBIZTONDO
        </div>
      )}
    </header>
  )
}