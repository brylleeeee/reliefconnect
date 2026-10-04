import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Lightweight modal (no Bootstrap JS needed). size: 'md' | 'lg' */
export default function Modal({ title, onClose, size = 'md', children }) {
  return createPortal(
    <div className="rc-modal-backdrop" onMouseDown={onClose}>
      <div className={`rc-modal ${size === 'lg' ? 'rc-modal-lg' : ''}`} role="dialog" aria-modal="true"
           aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="rc-card-title mb-0">{title}</h2>
          <button className="btn btn-link p-1 text-secondary" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}