/** Claimed-vs-quota bar used on the Distribution Events and Event Claims pages. */
export default function Progress({ claimed, quota }) {
  const pct = quota ? Math.min((claimed / quota) * 100, 100) : 0
  return (
    <div>
      <div className="rc-progress" title={`${claimed} of ${quota} households`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="small text-secondary mt-1">{claimed} of {quota} claimed ({Math.round(pct)}%)</div>
    </div>
  )
}
