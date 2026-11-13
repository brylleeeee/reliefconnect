import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import '../styles/select.css'

/**
 * Styled drop-in replacement for <select>. Use it exactly like a native select:
 *   <Select id="x" className="form-select form-select-sm mb-2" value={v} onChange={(e) => set(e.target.value)} required>
 *     <option value="">All</option>
 *     <optgroup label="Group"><option value="1">One</option></optgroup>
 *   </Select>
 * onChange gets { target: { value, id, name } } with the value as a string, like a native select.
 * A hidden native <select> mirrors the value so `required` and form validation keep working.
 * The list opens in a portal (not clipped by modals or scrolling tables) and gets a search box for long lists.
 * Mark "add new" choices with <option value={ADD} data-action>+ Add new source…</option>: they're pinned in a
 * green footer below the list (always visible, never filtered out by search) with a plus icon.
 */
const SEARCH_AT = 10 // show a search box when there are at least this many options

const textOf = (node) => {
  if (node == null || node === false || node === true) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf(node.props.children)
  return ''
}

/** Flattens <option>/<optgroup> children (incl. arrays, fragments and `cond && …`) into a list. */
function parseOptions(children, group = null, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) return parseOptions(child.props.children, group, out)
    if (child.type === 'optgroup') return parseOptions(child.props.children, child.props.label, out)
    if (child.type === 'option') {
      const action = !!child.props['data-action']
      const raw = textOf(child.props.children)
      out.push({
        value: String(child.props.value ?? raw),
        label: action ? raw.replace(/^\s*\+\s*/, '') : raw, // the plus is drawn as an icon
        disabled: !!child.props.disabled,
        group: action ? null : group,
        action,
      })
    }
  })
  return out
}

export default function Select({
  id, name, value, onChange, children, className = '', style, disabled = false, required = false,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy,
}) {
  const options = useMemo(() => parseOptions(children), [children])
  const current = String(value ?? '')
  const selected = options.find((o) => o.value === current)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1) // index into `shown`
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const typeahead = useRef({ text: '', t: 0 })
  const listId = useId()

  // Layout classes (mb-3, ms-auto…) go on the wrapper; size comes from form-select-sm
  const small = /\bform-select-sm\b/.test(className)
  const wrapClass = className.replace(/\bform-select(-sm|-lg)?\b/g, '').trim()

  const searchable = options.filter((o) => !o.action).length >= SEARCH_AT
  const q = query.trim().toLowerCase()
  // Normal options (filtered by the search), then the "add new" actions, which always stay
  const normal = options.filter((o) => !o.action)
  const actions = options.filter((o) => o.action)
  const shown = [...(q ? normal.filter((o) => o.label.toLowerCase().includes(q)) : normal), ...actions]
  const listCount = shown.length - actions.length

  const enabledIndex = (from, step) => {
    for (let i = from; i >= 0 && i < shown.length; i += step) if (!shown[i].disabled) return i
    return -1
  }

  const openList = () => {
    if (disabled) return
    setQuery('')
    setPos(null)
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) btnRef.current?.focus()
  }
  const choose = (opt) => {
    if (!opt || opt.disabled) return
    close()
    if (opt.value !== current) onChange?.({ target: { value: opt.value, id, name }, currentTarget: { value: opt.value, id, name } })
  }

  // When opening: highlight the selected option
  useEffect(() => {
    if (!open) return
    const i = shown.findIndex((o) => o.value === current)
    setActive(i >= 0 ? i : enabledIndex(0, 1))
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0)
  }, [open])

  // Typing in the search box: highlight the first match
  useEffect(() => { if (open) setActive(enabledIndex(0, 1)) }, [query])

  // Position under the button (or above it when there's no room), at least as wide as the button
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !panelRef.current) return
    const b = btnRef.current.getBoundingClientRect()
    const h = panelRef.current.offsetHeight
    const below = b.bottom + 6 + h <= window.innerHeight || b.top < h + 12
    const width = Math.max(b.width, 200)
    setPos({
      top: below ? b.bottom + 6 : b.top - 6 - h,
      left: Math.min(Math.max(8, b.left), window.innerWidth - width - 8),
      width,
    })
  }, [open, shown.length])

  // Close on outside click, scroll outside the list, or resize
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close(false)
    }
    const onScroll = (e) => { if (!panelRef.current?.contains(e.target)) close(false) }
    const onResize = () => close(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // Keep the highlighted option in view
  useEffect(() => {
    if (!open || active < 0) return
    panelRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList() }
      return
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive((i) => { const n = enabledIndex(i + 1, 1); return n < 0 ? i : n }); break
      case 'ArrowUp': e.preventDefault(); setActive((i) => { const n = enabledIndex(i - 1, -1); return n < 0 ? i : n }); break
      case 'Home': if (!searchable) { e.preventDefault(); setActive(enabledIndex(0, 1)) } break
      case 'End': if (!searchable) { e.preventDefault(); setActive(enabledIndex(shown.length - 1, -1)) } break
      case 'Enter': e.preventDefault(); choose(shown[active]); break
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break
      case 'Tab': close(false); break
      case ' ': if (!searchable) { e.preventDefault(); choose(shown[active]) } break
      default:
        // type-to-jump when there's no search box
        if (!searchable && e.key.length === 1) {
          const t = typeahead.current
          t.text = Date.now() - t.t < 600 ? t.text + e.key.toLowerCase() : e.key.toLowerCase()
          t.t = Date.now()
          const i = shown.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(t.text))
          if (i >= 0) setActive(i)
        }
    }
  }

  let lastGroup = null
  return (
    <div className={`rc-select ${small ? 'rc-select-sm' : ''} ${wrapClass}`} style={style}>
      {/* mirrors the value for `required` and native form validation; not visible or focusable */}
      <select className="rc-select-native" tabIndex={-1} aria-hidden="true" name={name} required={required}
              disabled={disabled} value={current} onChange={() => {}}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <button ref={btnRef} id={id} type="button" className="rc-select-btn" disabled={disabled}
              aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
              aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}
              onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}>
        {/* Every label is stacked in the same spot (only the selected one visible) so the field is as wide as its
            longest option, like a native select, and doesn't get squeezed in a flex row */}
        <span className="rc-select-value">
          <span className={`rc-select-current ${!selected || selected.disabled ? 'is-empty' : ''}${selected?.action ? ' is-action' : ''}`}>
            {selected?.action && <Plus size={small ? 13 : 14} strokeWidth={2.4} aria-hidden="true" />}
            {selected?.label ?? 'Select…'}
          </span>
          {options.map((o) => <span key={`s-${o.group ?? ''}-${o.value}`} className="rc-select-sizer" aria-hidden="true">{o.label}</span>)}
        </span>
        <ChevronDown size={small ? 14 : 16} className="rc-select-chevron" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div ref={panelRef} className="rc-select-panel" onKeyDown={onKeyDown}
             style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width, visibility: pos ? 'visible' : 'hidden' }}>
          {searchable && (
            <div className="rc-select-search">
              <Search size={14} aria-hidden="true" />
              <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…"
                     aria-label="Search options" aria-controls={listId}
                     aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} />
            </div>
          )}
          <ul ref={listRef} id={listId} role="listbox" className="rc-select-list" aria-label={ariaLabel}
              aria-activedescendant={!searchable && active >= 0 ? `${listId}-${active}` : undefined}>
            {shown.slice(0, listCount).map((o, i) => {
              const header = o.group && o.group !== lastGroup ? o.group : null
              lastGroup = o.group
              const isSel = o.value === current
              return (
                <Fragment key={`${o.group ?? ''}-${o.value}`}>
                  {header && <li className="rc-select-group" role="presentation">{header}</li>}
                  <li id={`${listId}-${i}`} data-i={i} role="option" aria-selected={isSel} aria-disabled={o.disabled || undefined}
                      className={`rc-select-option${isSel ? ' is-selected' : ''}${i === active ? ' is-active' : ''}${o.disabled ? ' is-disabled' : ''}${o.group ? ' in-group' : ''}`}
                      onMouseEnter={() => !o.disabled && setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => choose(o)}>
                    <span className="rc-select-option-label">{o.label}</span>
                    {isSel && <Check size={14} className="rc-select-check" aria-hidden="true" />}
                  </li>
                </Fragment>
              )
            })}
            {listCount === 0 && <li className="rc-select-empty" role="presentation">No matches</li>}
          </ul>
          {actions.length > 0 && (
            <ul className="rc-select-actions" role="group" aria-label="Add new">
              {actions.map((o, k) => {
                const i = listCount + k
                return (
                  <li key={`a-${o.value}`} id={`${listId}-${i}`} data-i={i} role="option" aria-selected={o.value === current}
                      className={`rc-select-action${i === active ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}>
                    <span className="rc-select-action-icon"><Plus size={13} strokeWidth={2.6} aria-hidden="true" /></span>
                    <span className="rc-select-option-label">{o.label}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
