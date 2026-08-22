import React, { useContext, useEffect, useRef, useState } from 'react'
import { DeanContext } from '../../context/DeanContext'
import { toast } from 'react-toastify'
import { AdminPageLayout, PageHero, McCard } from '../../components/mc'

const inputCls = 'w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

// ─── Image Crop Modal Component ─────────────────────────────────────────────
const CropModal = ({ imageSrc, onCrop, onClose }) => {
  const [crop, setCrop] = useState({ x: 10, y: 10, w: 300, h: 100 })
  const containerRef = useRef(null)
  const imgRef = useRef(null)
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const startMouse = useRef({ x: 0, y: 0 })
  const startCrop = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // Initialize crop box size to fit 3:1 aspect ratio inside image dimensions
  const handleImageLoad = () => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const w = rect.width * 0.8
    const h = w / 3
    setCrop({
      x: (rect.width - w) / 2,
      y: (rect.height - h) / 2,
      w: w,
      h: h
    })
  }

  // Mouse/Touch Down handlers
  const handleStartDrag = (e) => {
    e.stopPropagation()
    isDragging.current = true
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    startMouse.current = { x: clientX, y: clientY }
    startCrop.current = { ...crop }
  }

  const handleStartResize = (e) => {
    e.stopPropagation()
    e.preventDefault()
    isResizing.current = true
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    startMouse.current = { x: clientX, y: clientY }
    startCrop.current = { ...crop }
  }

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging.current && !isResizing.current) return
      const img = imgRef.current
      if (!img) return
      const rect = img.getBoundingClientRect()
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      
      const dx = clientX - startMouse.current.x
      const dy = clientY - startMouse.current.y

      if (isDragging.current) {
        let nextX = startCrop.current.x + dx
        let nextY = startCrop.current.y + dy
        
        // Bounds checking
        nextX = Math.max(0, Math.min(nextX, rect.width - crop.w))
        nextY = Math.max(0, Math.min(nextY, rect.height - crop.h))
        
        setCrop(prev => ({ ...prev, x: nextX, y: nextY }))
      } else if (isResizing.current) {
        let nextW = startCrop.current.w + dx
        // Maintain 3:1 aspect ratio
        let nextH = nextW / 3
        
        // Bounds checking
        if (nextW > 80 && (startCrop.current.x + nextW <= rect.width) && (startCrop.current.y + nextH <= rect.height)) {
          setCrop(prev => ({ ...prev, w: nextW, h: nextH }))
        }
      }
    }

    const handleEnd = () => {
      isDragging.current = false
      isResizing.current = false
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove)
    window.addEventListener('touchend', handleEnd)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
    }
  }, [crop])

  const handleApply = () => {
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    
    // Calculate ratio between natural resolution and displayed size
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    
    const canvas = document.createElement('canvas')
    canvas.width = 1200 // High-res output
    canvas.height = 400
    
    const ctx = canvas.getContext('2d')
    
    // Draw cropped portion
    ctx.drawImage(
      img,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.w * scaleX,
      crop.h * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )
    
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.9)
    onCrop(croppedDataUrl)
  }

  return (
    <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 select-none'>
      <div className='bg-slate-900 text-white rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl border border-slate-800 animate-fade-in'>
        <div className='flex justify-between items-center'>
          <div>
            <h3 className='text-lg font-black text-slate-100'>Crop Banner</h3>
            <p className='text-xs text-slate-400 mt-0.5'>Drag inside to move, use bottom-right circle to resize</p>
          </div>
          <button onClick={onClose} className='text-slate-400 hover:text-white text-xl font-bold'>&times;</button>
        </div>

        {/* Draggable cropping editor */}
        <div className='flex items-center justify-center bg-slate-950 rounded-2xl p-4 overflow-hidden border border-slate-800 min-h-[300px]'>
          <div ref={containerRef} className='relative overflow-hidden' style={{ display: 'inline-block' }}>
            <img
              ref={imgRef}
              src={imageSrc}
              crossOrigin='anonymous'
              onLoad={handleImageLoad}
              alt='To Crop'
              className='max-w-full max-h-[400px] select-none pointer-events-none'
            />
            {/* Dark mask overlay outside crop box using box-shadow */}
            <div
              onMouseDown={handleStartDrag}
              onTouchStart={handleStartDrag}
              style={{
                position: 'absolute',
                left: `${crop.x}px`,
                top: `${crop.y}px`,
                width: `${crop.w}px`,
                height: `${crop.h}px`,
                border: '2px dashed white',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                cursor: 'move',
              }}
              className='group'
            >
              {/* Resize Handle (bottom-right corner) */}
              <div
                onMouseDown={handleStartResize}
                onTouchStart={handleStartResize}
                style={{
                  position: 'absolute',
                  right: '-6px',
                  bottom: '-6px',
                  width: '14px',
                  height: '14px',
                  backgroundColor: '#0ea5e9',
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'se-resize',
                }}
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className='flex justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='px-5 py-2.5 bg-slate-800 text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-700 transition'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleApply}
            className='px-6 py-2.5 bg-sky-500 text-white rounded-xl font-bold text-sm shadow hover:bg-sky-600 transition'
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  )
}

const DeanHospital = () => {
  const { deanToken, hospital, getHospital, updateHospital } = useContext(DeanContext)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  // undefined = unchanged, '' = remove, dataURL string = new upload
  const [bannerChange, setBannerChange] = useState(undefined)
  const [showCropModal, setShowCropModal] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (deanToken) getHospital()
  }, [deanToken])

  useEffect(() => {
    if (hospital) setForm({
      name: hospital.name || '',
      address: hospital.address || '',
      mapsLink: hospital.maps_link || hospital.mapsLink || '',
      contact: hospital.contact || '',
      specialization: hospital.specialization || '',
    })
  }, [hospital])

  const existingBanner = hospital?.background_image || hospital?.backgroundImage || null
  const bannerUrl = bannerChange !== undefined ? (bannerChange || null) : existingBanner

  const handleSelectImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting same file
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Unsupported file type. Use JPG, PNG, JPEG or WEBP.')
      return
    }
    if (file.size > MAX_SIZE) {
      toast.error('Image is too large. Maximum size is 2 MB.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setBannerChange(dataUrl)
    } catch {
      toast.error('Could not read the selected image.')
    }
  }

  const handleRemoveImage = () => setBannerChange('')

  const startEditing = () => {
    setBannerChange(undefined)
    setEditing(true)
  }

  const cancelEditing = () => {
    setBannerChange(undefined)
    setEditing(false)
    if (hospital) setForm({
      name: hospital.name || '',
      address: hospital.address || '',
      mapsLink: hospital.maps_link || hospital.mapsLink || '',
      contact: hospital.contact || '',
      specialization: hospital.specialization || '',
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = { ...form }
    if (bannerChange !== undefined) payload.backgroundImage = bannerChange
    const ok = await updateHospital(payload)
    if (ok) {
      setEditing(false)
      setBannerChange(undefined)
    }
    setSaving(false)
  }

  if (!hospital) return (
    <AdminPageLayout>
      <div className='flex items-center justify-center min-h-[60vh]'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-sky-600' />
      </div>
    </AdminPageLayout>
  )

  const field = (label, key, placeholder = '') => (
    <div>
      <p className='text-[11px] font-bold uppercase tracking-wider text-sky-600 mb-1'>{label}</p>
      {editing ? (
        <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder} className={inputCls} />
      ) : (
        <p className='text-slate-800 text-sm font-medium py-1 break-words'>{hospital[key] || '—'}</p>
      )}
    </div>
  )

  const editAction = !editing ? (
    <button onClick={startEditing}
      className='px-4 py-2 bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-semibold rounded-lg shadow hover:shadow-lg transition'>
      Edit details
    </button>
  ) : (
    <div className='flex gap-2'>
      <button onClick={cancelEditing}
        className='px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition'>
        Cancel
      </button>
      <button onClick={handleSave} disabled={saving}
        className='px-4 py-2 bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-semibold rounded-lg shadow hover:shadow-lg transition disabled:opacity-50'>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <AdminPageLayout>
      <PageHero
        title="Hospital Tie ups"
        subtitle="Manage your hospital's information"
        features={['Verified Partner', 'Live Profile', 'Secure Records']}
      />

      {/* Hospital account banner — full-width horizontal banner from the uploaded photo */}
      <div className='relative overflow-hidden rounded-2xl shadow-lg min-h-[170px] flex items-end bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600'>
        {bannerUrl && (
          <>
            {/* Any uploaded photo (portrait or landscape) is cropped to a wide banner */}
            <img src={bannerUrl} alt='Hospital banner' className='absolute inset-0 h-full w-full object-cover object-center' />
            {/* Dark scrim so the title stays readable over any photo */}
            <div className='absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/20' />
          </>
        )}
        <div className='relative z-10 flex items-center gap-4 p-5 w-full'>
          <div className='w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white shrink-0'>
            <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' /></svg>
          </div>
          <div className='min-w-0 text-white'>
            <p className='text-[11px] font-semibold uppercase tracking-widest text-white/80'>Hospital Account</p>
            <h2 className='text-xl font-bold truncate drop-shadow'>{hospital.name}</h2>
            <p className='text-sm text-white/90 truncate'>{hospital.specialization}</p>
          </div>
        </div>
      </div>

      {/* Background image upload (edit mode only) */}
      {editing && (
        <McCard title="Hospital Background Image">
          <div className='flex flex-col sm:flex-row gap-5'>
            <div className='w-full sm:w-72 shrink-0'>
              <div className='aspect-[3/1] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center'>
                {bannerUrl ? (
                  <img src={bannerUrl} alt='Banner preview' className='w-full h-full object-cover' />
                ) : (
                  <div className='flex flex-col items-center gap-1 text-slate-400'>
                    <svg className='w-7 h-7' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' /></svg>
                    <span className='text-[11px] font-medium'>No banner uploaded</span>
                  </div>
                )}
              </div>
            </div>

            <div className='flex-1 flex flex-col justify-center gap-3'>
              <div className='flex flex-wrap gap-2'>
                <button type='button' onClick={() => fileRef.current?.click()}
                  className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-teal-500 text-white text-sm font-semibold shadow hover:shadow-lg transition'>
                  <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' /></svg>
                  {bannerUrl ? 'Change Image' : 'Upload Image'}
                </button>
                {bannerUrl && (
                  <button type='button' onClick={() => setShowCropModal(true)}
                    className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-sky-200 text-sky-600 text-sm font-semibold hover:bg-sky-50 transition'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18' /></svg>
                    Crop Image
                  </button>
                )}
                {bannerUrl && (
                  <button type='button' onClick={handleRemoveImage}
                    className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' /></svg>
                    Remove
                  </button>
                )}
              </div>
              <p className='text-[11px] text-slate-400'>Upload any photo — portrait or landscape. It is automatically cropped to a wide banner and used as the hospital image in the app. JPG/PNG/WebP, max 2 MB.</p>
              <input ref={fileRef} type='file' accept='image/jpeg,image/png,image/webp' hidden onChange={handleSelectImage} />
            </div>
          </div>
        </McCard>
      )}

      {/* Details card */}
      <McCard title="Hospital Information" action={editAction}>
        <div className='space-y-5'>
          {field('Hospital Name', 'name', 'Enter hospital name')}
          {field('Address', 'address', 'Full text address')}

          <div>
            <p className='text-[11px] font-bold uppercase tracking-wider text-sky-600 mb-1'>Google Maps Link</p>
            {editing ? (
              <input value={form.mapsLink || ''} onChange={e => setForm(f => ({ ...f, mapsLink: e.target.value }))}
                placeholder='https://maps.google.com/...' className={inputCls} />
            ) : (
              (hospital.maps_link || hospital.mapsLink) ? (
                <a href={hospital.maps_link || hospital.mapsLink} target='_blank' rel='noreferrer'
                  className='text-sm font-medium text-sky-600 hover:underline break-all py-1 inline-flex items-center gap-1'>
                  <svg className='w-4 h-4 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' /><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 11a3 3 0 11-6 0 3 3 0 016 0z' /></svg>
                  Open in Google Maps
                </a>
              ) : (
                <p className='text-slate-800 text-sm font-medium py-1'>—</p>
              )
            )}
          </div>

          {field('Contact Number', 'contact', 'Phone number')}
          {field('Specialization', 'specialization', 'E.g. Cardiology, General Medicine')}

          <div className='pt-3 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-1'>
            <p className='text-xs text-slate-400'>Hospital Type: <span className='font-semibold text-slate-600'>{hospital.type || '—'}</span></p>
            <p className='text-xs text-slate-400'>Hospital ID: <span className='font-semibold text-slate-600'>{hospital.id}</span></p>
          </div>
        </div>
      </McCard>

      {showCropModal && bannerUrl && (
        <CropModal
          imageSrc={bannerUrl}
          onClose={() => setShowCropModal(false)}
          onCrop={(croppedDataUrl) => {
            setBannerChange(croppedDataUrl)
            setShowCropModal(false)
          }}
        />
      )}
    </AdminPageLayout>
  )
}

export default DeanHospital
