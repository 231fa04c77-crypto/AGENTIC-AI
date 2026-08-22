import React, { useState, useRef, useEffect } from 'react'
import { toast } from 'react-toastify'
import { exportToExcel, exportToPDF } from '../../utils/exportData'

/**
 * Reusable Export dropdown (Excel + PDF) for any table/list page.
 *
 * Props:
 *  - columns: [{ key|fn, label, format? }]
 *  - rows: array of objects (or () => array)
 *  - filename: base file name
 *  - title: PDF document title
 *  - subtitle: optional PDF subtitle (e.g. active filters)
 *  - orientation: 'landscape' | 'portrait'
 *  - disabled: boolean
 *  - className: extra classes for the trigger button
 */
const ExportMenu = ({
  columns,
  rows,
  filename = 'export',
  title = 'Report',
  subtitle = '',
  orientation = 'landscape',
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const resolveRows = () => (typeof rows === 'function' ? rows() : rows) || []

  const run = (kind) => {
    const data = resolveRows()
    if (!data.length) {
      toast.info('Nothing to export')
      setOpen(false)
      return
    }
    try {
      const payload = { filename, title, subtitle, columns, rows: data, orientation }
      if (kind === 'excel') exportToExcel(payload)
      else exportToPDF(payload)
      toast.success(`Exported ${data.length} record(s) to ${kind === 'excel' ? 'Excel' : 'PDF'}`)
    } catch (err) {
      console.error(err)
      toast.error('Export failed')
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-colors ${className}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-scale-in origin-top-right">
          <button
            type="button"
            onClick={() => run('excel')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6M5 21h14a2 2 0 002-2V7l-4-4H5a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </span>
            Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => run('pdf')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </span>
            PDF (.pdf)
          </button>
        </div>
      )}
    </div>
  )
}

export default ExportMenu
