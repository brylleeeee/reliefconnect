export function PriorityBadge({ level, score }) {
  if (!level) return null
  return (
    <span className={`rc-prio ${level}`}>
      {level}{score !== undefined && <span className="rc-prio-score">{score}</span>}
    </span>
  )
}

const STATUS_LABELS = { unscheduled: 'not scheduled' }

export function StatusBadge({ status }) {
  return <span className={`rc-status ${status}`}>{STATUS_LABELS[status] ?? status}</span>
}
