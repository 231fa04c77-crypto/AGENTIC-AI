import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { extractPharmacyOrderId } from '../utils/pharmacyOrderId'

const SCAN_DEBOUNCE_MS = 1500

/**
 * Camera QR scanner for hospital pharmacy counter pickup (PHO…).
 * Same BarcodeDetector → jsQR pattern as reception booking scanner.
 */
export function useQrPharmacyScanner({ enabled, onCode }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const lastScanRef = useRef({ code: '', at: 0 })
  const onCodeRef = useRef(onCode)
  const [camOn, setCamOn] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  const stopCam = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamOn(false)
    setScanning(false)
  }, [])

  const emitCode = useCallback((raw) => {
    const code = extractPharmacyOrderId(raw)
    const payload = code || String(raw || '').trim()
    if (!payload) return
    const now = Date.now()
    if (
      lastScanRef.current.code === payload &&
      now - lastScanRef.current.at < SCAN_DEBOUNCE_MS
    ) {
      return
    }
    lastScanRef.current = { code: payload, at: now }
    onCodeRef.current?.(code, raw)
  }, [])

  const tick = useCallback(async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => {
        void tick()
      })
      return
    }

    try {
      if (typeof window !== 'undefined' && window.BarcodeDetector) {
        const detector =
          tick._detector ||
          (tick._detector = new window.BarcodeDetector({
            formats: ['qr_code'],
          }))
        const codes = await detector.detect(video)
        if (codes?.length) {
          emitCode(codes[0].rawValue || '')
        }
      } else {
        const canvas = canvasRef.current || document.createElement('canvas')
        canvasRef.current = canvas
        const w = video.videoWidth
        const h = video.videoHeight
        if (w && h) {
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(video, 0, 0, w, h)
          const imageData = ctx.getImageData(0, 0, w, h)
          const result = jsQR(imageData.data, w, h, {
            inversionAttempts: 'dontInvert',
          })
          if (result?.data) emitCode(result.data)
        }
      }
    } catch {
      /* keep scanning */
    }

    if (streamRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        void tick()
      })
    }
  }, [emitCode])

  const startCam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCamOn(true)
      setScanning(true)
      rafRef.current = requestAnimationFrame(() => {
        void tick()
      })
      return true
    } catch {
      stopCam()
      return false
    }
  }, [stopCam, tick])

  const toggleCam = useCallback(async () => {
    if (camOn) {
      stopCam()
      return false
    }
    return startCam()
  }, [camOn, startCam, stopCam])

  useEffect(() => {
    if (!enabled && camOn) stopCam()
  }, [enabled, camOn, stopCam])

  useEffect(() => () => stopCam(), [stopCam])

  return { videoRef, camOn, scanning, toggleCam, stopCam, startCam }
}
