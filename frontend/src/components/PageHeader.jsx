export default function PageHeader({ title, subtitle }) {
  return (
    <header className="rc-page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="rc-lgu-tag">
        <span className="rc-flag"><i /><i /><i /></span>
        LGU URBIZTONDO
      </div>
    </header>
  )
}
