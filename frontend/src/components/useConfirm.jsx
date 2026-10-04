import { useCallback, useRef, useState } from 'react'
import Modal from './Modal'

/**
 * In-app confirmation window, used instead of the browser's "localhost says" box.
 *
 *   const [confirm, confirmDialog] = useConfirm()
 *   if (!(await confirm({ title: 'Delete event?', message: '…', confirmLabel: 'Delete', danger: true }))) return
 *   ...
 *   return <>{page}{confirmDialog}</>
 */
export default function useConfirm() {
  const [ask, setAsk] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve
    setAsk(options)
  }), [])

  const answer = (value) => {
    resolver.current?.(value)
    resolver.current = null
    setAsk(null)
  }

  const dialog = ask && (
    <Modal title={ask.title} onClose={() => answer(false)}>
      <p className="small text-secondary" style={{ whiteSpace: 'pre-line' }}>{ask.message}</p>
      <div className="d-flex justify-content-end gap-2">
        <button className="btn btn-light" onClick={() => answer(false)} autoFocus>{ask.cancelLabel ?? 'Cancel'}</button>
        <button className={`btn ${ask.danger ? 'btn-danger' : 'btn-rc'}`} onClick={() => answer(true)}>
          {ask.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </Modal>
  )

  return [confirm, dialog]
}
