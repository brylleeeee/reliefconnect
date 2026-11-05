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

/** No able-bodied adult (seniors living alone, a PWD alone…): priority lane or home delivery. */
export function AssistTag({ show }) {
  if (!show) return null
  return (
    <span className="rc-tag rc-tag-assist ms-1" title="No able-bodied adult in the household: serve in the priority lane or deliver to their home">
      Needs assistance
    </span>
  )
}
