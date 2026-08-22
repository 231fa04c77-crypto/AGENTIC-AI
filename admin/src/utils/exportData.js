import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const BRAND = '#0F4C81'

function safe(name) {
  return String(name || 'export').replace(/[^a-z0-9-_]+/gi, '_').replace(/_+/g, '_').toLowerCase()
}

function stamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}

/**
 * Build plain string matrix from columns + rows.
 * columns: [{ key, label, format?(value, row) }]
 * rows: array of objects
 */
function buildMatrix(columns, rows) {
  const headers = columns.map((c) => c.label)
  const body = (rows || []).map((row) =>
    columns.map((c) => {
      const raw = typeof c.key === 'function' ? c.key(row) : row?.[c.key]
      const val = c.format ? c.format(raw, row) : raw
      if (val === null || val === undefined) return ''
      return typeof val === 'object' ? JSON.stringify(val) : String(val)
    })
  )
  return { headers, body }
}

/**
 * Export an array of objects to a styled .xlsx file.
 */
export function exportToExcel({ filename, sheetName = 'Sheet1', columns, rows }) {
  const { headers, body } = buildMatrix(columns, rows)
  const aoa = [headers, ...body]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Auto column widths based on content length.
  ws['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(
      String(h).length,
      ...body.map((r) => String(r[i] ?? '').length)
    )
    return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
  XLSX.writeFile(wb, `${safe(filename)}_${stamp()}.xlsx`)
}

/**
 * Export an array of objects to a branded, paginated PDF table.
 */
export function exportToPDF({ filename, title = 'Report', subtitle = '', columns, rows, orientation = 'landscape' }) {
  const { headers, body } = buildMatrix(columns, rows)
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header band
  doc.setFillColor(BRAND)
  doc.rect(0, 0, pageWidth, 54, 'F')
  doc.setTextColor('#FFFFFF')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('MEDCLUES', 40, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(title, 40, 44)

  doc.setTextColor('#6B7280')
  doc.setFontSize(8)
  const generated = `Generated: ${new Date().toLocaleString()}`
  doc.text(generated, pageWidth - 40, 28, { align: 'right' })
  if (subtitle) doc.text(String(subtitle), pageWidth - 40, 42, { align: 'right' })

  autoTable(doc, {
    head: [headers],
    body,
    startY: 68,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 246, 250] },
    didDrawPage: (d) => {
      const page = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor('#9CA3AF')
      doc.text(
        `Page ${page}`,
        pageWidth - 40,
        doc.internal.pageSize.getHeight() - 16,
        { align: 'right' }
      )
      doc.text(
        `${(rows || []).length} record(s)`,
        40,
        doc.internal.pageSize.getHeight() - 16
      )
    },
  })

  doc.save(`${safe(filename)}_${stamp()}.pdf`)
}
