/** Human-readable MEDCLUES public ID for admin tables. */
export function formatPublicId(entity, prefix, numericId) {
  const fromApi = entity?.publicId || entity?.public_id
  if (fromApi) return String(fromApi).toUpperCase()
  const id = numericId ?? entity?.id ?? entity?._id
  if (id == null || id === '') return '—'
  return `${prefix}${String(id).padStart(8, '0')}`
}

export function publicIdBadgeClass(tone = 'indigo') {
  const tones = {
    indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    violet: 'text-violet-700 bg-violet-50 border-violet-100',
    slate: 'text-slate-700 bg-slate-50 border-slate-200',
  }
  return `font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border ${tones[tone] || tones.indigo}`
}
