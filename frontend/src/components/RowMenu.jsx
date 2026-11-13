import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisVertical } from 'lucide-react'

/**
 * Three-dot button for a table row's actions. Clicking it opens a small menu; picking an item runs
 * its onClick. Items: [{ label, onClick, icon?, hint?, tone?, danger?, disabled?, title? }]; falsy entries are skipped,
 * tone: 'green' | 'amber' | 'red' colors the icon chip (danger implies red and adds a divider above it);
 * so callers can write `cond && { ... }` to keep their existing show/hide rules.
 *
 * The menu is rendered in a portal with fixed positioning so it isn't clipped by .table-responsive
 * (which scrolls), and it opens upward when there isn't room below the button (last rows).
 */
export default function RowMenu({ items, label = 'Actions' }) {
  const list = items.filter(Boolean)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  // Place the menu under the button, right-aligned; flip above it if it would run off the screen
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return
    const b = btnRef.current.getBoundingClientRect()
    const m = menuRef.current.getBoundingClientRect()
    const below = b.bottom + 4 + m.height <= window.innerHeight
    setPos({
      top: below ? b.bottom + 4 : Math.max(4, b.top - 4 - m.height),
      left: Math.max(4, b.right - m.width),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true) // the table or page scrolled: the menu would float away
    window.addEventListener('resize', close)
    menuRef.current?.querySelector('button:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = () => { setPos(null); setOpen((o) => !o) }

  const pick = (item) => {
    setOpen(false)
    item.onClick()
  }

  // Arrow keys move between the menu items
  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = [...menuRef.current.querySelectorAll('button:not(:disabled)')]
    const i = btns.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length
    btns[next]?.focus()
  }

  return (
    <>
      <button ref={btnRef} type="button" className="btn-icon d-inline-grid align-middle rc-row-menu-btn"
              aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <EllipsisVertical size={16} />
      </button>
      {open && createPortal(
        <div ref={menuRef} role="menu" className="rc-row-menu" onKeyDown={onMenuKey}
             style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
          {list.map((item, i) => {
            const Icon = item.icon
            const tone = item.danger ? 'red' : item.tone || 'green'
            return (
              <div key={item.label}>
                {item.danger && i > 0 && <div className="rc-row-menu-sep" role="separator" />}
                <button type="button" role="menuitem"
                        className={`rc-row-menu-item tone-${tone}${item.danger ? ' danger' : ''}`}
                        disabled={item.disabled} title={item.title} onClick={() => pick(item)}>
                  {Icon && <span className="rc-row-menu-icon"><Icon size={14} strokeWidth={2.2} /></span>}
                  <span className="rc-row-menu-text">
                    <span className="rc-row-menu-label">{item.label}</span>
                    {item.hint && <span className="rc-row-menu-hint">{item.hint}</span>}
                  </span>
                </button>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
