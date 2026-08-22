import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { assets } from '../assets/assets'
import BackButton from '../components/BackButton'
import BackArrow from '../components/BackArrow'
import LoadingSpinner, { SkeletonAppointment, ButtonSpinner } from '../components/LoadingSpinner'
import QueueTracker from '../components/QueueTracker'
import QRCode from 'react-qr-code'
import PaymentModal from '../components/PaymentModal'
import { isOnlineVideoAppointment } from '../utils/videoConsult'
import { labelForAppointment } from '../utils/lifecycleLabels'
import { checkInQrPayload, appointmentQrPayload } from '../utils/bookingQr'
// Dynamic imports to avoid Vite pre-bundling issues

const MyAppointments = () => {

    const { backendUrl, token } = useContext(AppContext)
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()

    const [appointments, setAppointments] = useState([])
    const [payOnlineLoadingId, setPayOnlineLoadingId] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [cancellingId, setCancellingId] = useState(null)
    const [downloadingOPForm, setDownloadingOPForm] = useState(null) // Track which OP form is being downloaded (appointment ID)
    const [opFormProgress, setOpFormProgress] = useState({}) // Track progress percentage for each OP form { appointmentId: percentage }
    const [appointmentFilter, setAppointmentFilter] = useState('All') // 'All', 'Pending Payment', 'Payment Completed', 'Cancelled'
    const [expandedAppointments, setExpandedAppointments] = useState({}) // Track which appointments have details expanded
    const [expandedQueueStatus, setExpandedQueueStatus] = useState({}) // Track which queue status sections are expanded
    const [showPaymentModal, setShowPaymentModal] = useState(false)
    const [selectedAppointmentForPayment, setSelectedAppointmentForPayment] = useState(null)
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Function to format the date eg. ( 20_01_2000 => 20 Jan 2000 )
    const slotDateFormat = (slotDate) => {
        if (!slotDate) return 'N/A'
        const dateArray = slotDate.split('_')
        if (dateArray.length < 3) return slotDate
        return dateArray[0] + " " + months[Number(dateArray[1]) - 1] + " " + dateArray[2]
    }

    // Extract MD/MBBS/MS from name or add it based on variety
    const getDoctorNameWithMD = (name, index, degree) => {
        if (!name) return 'Doctor'
        const degrees = ['MD', 'MBBS', 'MS']
        
        // Use degree if provided, else rotate based on index, else default to 'MD'
        let deg = degree;
        if (!deg || deg === 'undefined') {
            const idx = typeof index === 'number' ? index : 0;
            deg = degrees[idx % degrees.length];
        }
        if (!deg) deg = 'MD';

        // Add degree in parentheses if not already present
        let formattedName = name;
        if (name && !name.includes(`(${deg})`)) {
            formattedName = `${name} (${deg})`;
        }
        
        // Ensure "Dr. " prefix
        return formattedName.startsWith('Dr.') ? formattedName : `Dr. ${formattedName}`;
    }

    // Reception check-in QR = bare BK…; completed visits use visit-summary URL.
    const generateQRData = (item) => {
        return appointmentQrPayload(item) || checkInQrPayload(item) || ''
    }

    // Download receipt
    const handleDownloadReceipt = (item) => {
        const receiptText = `
MedClues Healthcare
Appointment Receipt
=====================================

Appointment ID: ${item._id}
Token Number: ${item.tokenNumber || 'N/A'}
Date: ${slotDateFormat(item.slotDate)} at ${item.slotTime}

APPOINTMENT DETAILS
-------------------
Patient Name: ${item.userData?.name || 'N/A'}
Doctor: ${item.docData?.name || 'N/A'}
Specialty: ${item.docData?.speciality || item.docData?.specialty || item.docData?.specialization || 'N/A'}
${item.docData?.address ? `Address: ${item.docData.address.line1}${item.docData.address.line2 ? ', ' + item.docData.address.line2 : ''}` : ''}

PAYMENT DETAILS
---------------
Amount: ₹${item.amount || 0}
Payment Status: ${item.payment ? 'Paid' : 'Pending'}
Payment Method: ${item.paymentMethod || 'Online'}

=====================================
Thank you for choosing MedClues Healthcare!
        `.trim()

        const blob = new Blob([receiptText], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `appointment_receipt_${item._id}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success('Receipt downloaded successfully')
    }

    // Handle online payment via Razorpay
    const handlePayOnline = (item) => {
        setSelectedAppointmentForPayment(item)
        setShowPaymentModal(true)
    }

    const onRazorpayPayment = async (appointmentId) => {
        const item = selectedAppointmentForPayment
        if (!item || !token) return
        
        setIsPaymentProcessing(true)
        try {
            // Step 1: Create Razorpay order on backend
            const { data } = await axios.post(
                backendUrl + '/api/payments/appointment-order',
                { appointmentId: appointmentId.toString() },
                { headers: { token } }
            )

            if (!data?.success || !data?.order) {
                toast.error(data?.message || 'Failed to initialize Razorpay payment')
                setIsPaymentProcessing(false)
                return
            }

            // Step 2: Build Razorpay options
            const razorpayOptions = {
                key: data.order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: data.order.amount,
                currency: data.order.currency || 'INR',
                name: 'MedClues',
                description: `Appointment with Dr. ${item.docData?.name || 'Doctor'}`,
                order_id: data.order.id,
                handler: async function (response) {
                    try {
                        // Step 3: Verify payment signature
                        const { data: verifyData } = await axios.post(
                            backendUrl + '/api/payments/appointment-verify',
                            {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                appointment_id: appointmentId.toString()
                            },
                            { headers: { token } }
                        )
                        if (verifyData.success) {
                            toast.success('Payment successful! Your appointment is confirmed.')
                            setShowPaymentModal(false)
                            getUserAppointments()
                        } else {
                            toast.error(verifyData.message || 'Payment verification failed.')
                        }
                    } catch (err) {
                        toast.error('Payment verification error')
                    } finally {
                        setIsPaymentProcessing(false)
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsPaymentProcessing(false)
                    }
                }
            }

            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => {
                const rzp = new window.Razorpay(razorpayOptions)
                rzp.open()
            }
            document.body.appendChild(script)
        } catch (err) {
            toast.error('Failed to start Razorpay flow')
            setIsPaymentProcessing(false)
        }
    }

    // Download OP Form (Out Patient Form) - PDF Format
    const handleDownloadOPForm = async (item) => {
        setDownloadingOPForm(item._id)
        setOpFormProgress(prev => ({ ...prev, [item._id]: 1 }))
        try {
            const isPaid = item.payment === true || item.payment === "true" || item.payment === 1
            const hospitalName = item.hospitalData?.name || item.docData?.hospitalName || 'MedClues Healthcare'

            // Convert logo to base64 for PDF
            const logoToBase64 = (src) => {
                return new Promise((resolve) => {
                    const img = new Image()
                    img.crossOrigin = 'anonymous'
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        canvas.width = img.width
                        canvas.height = img.height
                        const ctx = canvas.getContext('2d')
                        ctx.drawImage(img, 0, 0)
                        resolve(canvas.toDataURL('image/png'))
                    }
                    img.onerror = () => resolve('')
                    img.src = assets.logo
                })
            }

            setOpFormProgress(prev => ({ ...prev, [item._id]: 10 }))
            const logoBase64 = await logoToBase64(assets.logo)
            setOpFormProgress(prev => ({ ...prev, [item._id]: 20 }))

            const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OP Form - ${item._id}</title>
    <style>
        @page {
            size: A4;
            margin: 10mm;
        }
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1f2937;
            line-height: 1.4;
            background: #ffffff;
            padding: 0;
            font-size: 11px;
        }
        .official-container {
            border: 2px solid #0c4a6e;
            padding: 15px;
            position: relative;
            min-height: 270mm;
        }
        .official-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0ea5e9;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .hospital-branding {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .logo-img {
            width: 60px;
            height: 60px;
            object-fit: contain;
        }
        .hospital-info h1 {
            font-size: 22px;
            color: #0c4a6e;
            margin: 0;
            text-transform: uppercase;
        }
        .hospital-info p {
            font-size: 10px;
            color: #4b5563;
        }
        .form-type {
            text-align: right;
        }
        .form-type h2 {
            font-size: 16px;
            color: #0ea5e9;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .form-type p {
            font-size: 9px;
            color: #9ca3af;
        }
        .grid-layout {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        .info-card {
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
        }
        .card-header {
            background: #f8fafc;
            padding: 6px 10px;
            border-bottom: 1px solid #e5e7eb;
            font-weight: 700;
            color: #0c4a6e;
            text-transform: uppercase;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
        }
        .card-body {
            padding: 8px 10px;
        }
        .info-row {
            display: flex;
            margin-bottom: 4px;
        }
        .info-label {
            width: 100px;
            font-weight: 600;
            color: #4b5563;
        }
        .info-value {
            flex: 1;
            color: #111827;
            font-weight: 500;
        }
        .token-badge {
            background: #0ea5e9;
            color: white;
            padding: 2px 8px;
            border-radius: 99px;
            font-weight: 800;
            font-size: 14px;
        }
        .payment-status {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .paid { background: #dcfce7; color: #166534; }
        .pending { background: #fef9c3; color: #854d0e; }
        
        .qr-section {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 10px;
            background: #f8fafc;
            border: 1px dashed #0c4a6e;
            border-radius: 6px;
            height: 100%;
        }
        .instruction-box {
            margin-top: 15px;
            padding: 12px;
            background: #f1f5f9;
            border-radius: 4px;
        }
        .instruction-box h3 {
            font-size: 11px;
            margin-bottom: 6px;
            color: #0c4a6e;
            text-transform: uppercase;
        }
        .instruction-box ul {
            padding-left: 18px;
        }
        .instruction-box li {
            margin-bottom: 3px;
            font-size: 10px;
        }
        .footer {
            margin-top: auto;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 9px;
            color: #6b7280;
        }
        .stamp-box {
            width: 100px;
            height: 60px;
            border: 1px dashed #d1d5db;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #d1d5db;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="official-container">
        <div class="official-header">
            <div class="hospital-branding">
                ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" />` : '<div style="width:60px; height:60px; background:#0ea5e9; border-radius:4px;"></div>'}
                <div class="hospital-info">
                    <h1>${hospitalName}</h1>
                    <p>Advanced Healthcare & Research Center</p>
                    <p>Digitalized Health Management System</p>
                </div>
            </div>
            <div class="form-type">
                <h2>OUTPATIENT FORM</h2>
                <p>REF ID: ${String(item._id).substring(0, 12)}</p>
                <p>GEN: ${new Date().toLocaleDateString()}</p>
            </div>
        </div>

        <div class="grid-layout">
            <div class="info-card">
                <div class="card-header">
                    <span>Patient Information</span>
                    <span class="payment-status ${isPaid ? 'paid' : 'pending'}">${isPaid ? 'PAID' : 'PENDING'}</span>
                </div>
                <div class="card-body">
                    <div class="info-row"><span class="info-label">Name:</span> <span class="info-value"><strong>${item.userData?.name || item.actualPatient?.name || 'N/A'}</strong></span></div>
                    <div class="info-row"><span class="info-label">Age/Gender:</span> <span class="info-value">${item.userData?.age || item.actualPatient?.age || 'N/A'}Y / ${item.userData?.gender || item.actualPatient?.gender || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Contact:</span> <span class="info-value">${item.userData?.phone || item.actualPatient?.phone || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Email:</span> <span class="info-value">${item.userData?.email || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Blood Group:</span> <span class="info-value">${item.userData?.bloodGroup || 'N/A'}</span></div>
                </div>
            </div>
            <div class="info-card">
                <div class="card-header">Appointment Token</div>
                <div class="card-body" style="text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100px;">
                    <span style="font-size: 10px; color: #64748b; margin-bottom: 5px;">Your Token Number</span>
                    <span class="token-badge">#${item.tokenNumber || 'N/A'}</span>
                    <span style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Present this at the counter</span>
                </div>
            </div>
        </div>

        <div class="grid-layout">
            <div class="info-card">
                <div class="card-header">Doctor & Schedule</div>
                <div class="card-body">
                    <div class="info-row"><span class="info-label">Doctor:</span> <span class="info-value"><strong>${item.docData?.name || 'N/A'}</strong></span></div>
                    <div class="info-row"><span class="info-label">Specialty:</span> <span class="info-value">${item.docData?.speciality || 'N/A'}</span></div>
                    <div class="info-row"><span class="info-label">Date:</span> <span class="info-value">${slotDateFormat(item.slotDate)}</span></div>
                    <div class="info-row"><span class="info-label">Time Slot:</span> <span class="info-value">${item.slotTime}</span></div>
                    ${item.docData?.address ? `<div class="info-row"><span class="info-label">Location:</span> <span class="info-value">${item.docData.address.line1}, ${item.docData.address.city || ''}</span></div>` : ''}
                </div>
            </div>
            <div class="qr-section">
                <div id="qr-code-container-${item._id}"></div>
                <p style="font-size: 8px; font-weight: 700; color: #0c4a6e; margin-top: 5px;">SCAN FOR QUICK CHECK-IN</p>
            </div>
        </div>

        <div class="info-card" style="margin-bottom: 15px;">
            <div class="card-header">Consultation Summary</div>
            <div class="card-body">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div>
                        <p style="font-weight: 600; color: #4b5563;">Reason for Visit / Symptoms:</p>
                        <p style="margin-top: 5px; color: #1f2937;">${item.selectedSymptoms && item.selectedSymptoms.length > 0 ? item.selectedSymptoms.join(', ') : 'General Checkup'}</p>
                    </div>
                    <div style="text-align: right; min-width: 150px;">
                        <div class="info-row"><span class="info-label" style="width: auto; margin-right: 10px;">Consultation Fee:</span> <span class="info-value">₹${item.amount || 0}</span></div>
                        <div class="info-row"><span class="info-label" style="width: auto; margin-right: 10px;">Payment Mode:</span> <span class="info-value">${item.paymentMethod || 'Online'}</span></div>
                        <div class="info-row"><span class="info-label" style="width: auto; margin-right: 10px;">Transaction ID:</span> <span class="info-value">${item.transactionId || 'Pending'}</span></div>
                    </div>
                </div>
            </div>
        </div>

        <div class="instruction-box">
            <h3>Standard Guidelines</h3>
            <ul>
                <li>Please arrive at the clinic 15 minutes before your scheduled time slot.</li>
                <li>Carry a valid ID proof and previous medical records if any.</li>
                <li>Digital or printed copy of this form is mandatory for check-in.</li>
                <li>In case of cancellations, please update through the app at least 2 hours prior.</li>
                <li>Temperature check and mask are mandatory within clinic premises.</li>
            </ul>
        </div>

        <div class="footer">
            <div>
                <p>System Generated Document - MedClues Digital Health Platform</p>
                <p>Support: support@medclues.com | ID: ${String(item._id)}</p>
            </div>
            <div class="stamp-box">Hospital Stamp</div>
            <div style="text-align: center;">
                <div style="width: 120px; border-top: 1px solid #1f2937; margin-top: 40px; padding-top: 2px;">AUTHORISED SIGNATORY</div>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim()

            // Create a temporary div to hold the HTML content
            const tempDiv = document.createElement('div')
            tempDiv.innerHTML = htmlContent
            tempDiv.style.position = 'absolute'
            tempDiv.style.left = '-9999px'
            tempDiv.style.width = '210mm'
            tempDiv.style.padding = '20px'
            tempDiv.style.backgroundColor = '#fff'
            document.body.appendChild(tempDiv)

            // Generate QR code and insert it (COMPULSORY on 2nd page)
            setOpFormProgress(prev => ({ ...prev, [item._id]: 30 }))
            const qrContainer = tempDiv.querySelector(`#qr-code-container-${item._id}`)
            if (!qrContainer) {
                console.error('QR code container not found! This should not happen.')
                toast.error('Error: QR code container missing. Please try again.', {
                    hideProgressBar: true
                })
                setDownloadingOPForm(null)
                setOpFormProgress(prev => {
                    const newProgress = { ...prev }
                    delete newProgress[item._id]
                    return newProgress
                })
                return
            }
            // Always generate QR code - compulsory on 2nd page (bare BK when available)
            const qrData = generateQRCodeSVG(item)
            qrContainer.innerHTML = qrData

            // Wait for images to load, then generate PDF using dynamic imports
            setTimeout(async () => {
                try {
                    setOpFormProgress(prev => ({ ...prev, [item._id]: 40 }))
                    // Dynamically import html2canvas and jsPDF
                    const html2canvas = (await import('html2canvas')).default
                    const jsPDF = (await import('jspdf')).default

                    setOpFormProgress(prev => ({ ...prev, [item._id]: 50 }))
                    const canvas = await html2canvas(tempDiv, {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        width: tempDiv.scrollWidth,
                        height: tempDiv.scrollHeight,
                        onclone: (clonedDoc) => {
                            setOpFormProgress(prev => ({ ...prev, [item._id]: 70 }))
                        }
                    })

                    setOpFormProgress(prev => ({ ...prev, [item._id]: 80 }))
                    const imgData = canvas.toDataURL('image/png')
                    const pdf = new jsPDF('p', 'mm', 'a4')
                    const imgWidth = 210
                    const pageHeight = 297
                    const imgHeight = (canvas.height * imgWidth) / canvas.width

                    // Force it onto one page if it's close, otherwise handle overflow
                    setOpFormProgress(prev => ({ ...prev, [item._id]: 85 }))
                    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)

                    if (imgHeight > pageHeight) {
                        let heightLeft = imgHeight - pageHeight
                        let position = -pageHeight
                        while (heightLeft > 0) {
                            pdf.addPage()
                            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
                            heightLeft -= pageHeight
                            position -= pageHeight
                        }
                    }

                    setOpFormProgress(prev => ({ ...prev, [item._id]: 95 }))
                    const appointmentIdStr = String(item._id || 'appointment')
                    pdf.save(`OP_Form_${appointmentIdStr.substring(0, 12)}.pdf`)
                    document.body.removeChild(tempDiv)
                    setOpFormProgress(prev => ({ ...prev, [item._id]: 100 }))

                    // Hide toast progress bar
                    toast.success('OP Form downloaded as PDF successfully!', {
                        hideProgressBar: true
                    })
                } catch (error) {
                    console.error('Error generating PDF:', error)
                    if (tempDiv.parentNode) {
                        document.body.removeChild(tempDiv)
                    }
                    toast.error('Failed to generate PDF. Please try again.', {
                        hideProgressBar: true
                    })
                    setDownloadingOPForm(null)
                    setOpFormProgress(prev => {
                        const newProgress = { ...prev }
                        delete newProgress[item._id]
                        return newProgress
                    })
                } finally {
                    setTimeout(() => {
                        setDownloadingOPForm(null)
                        setOpFormProgress(prev => {
                            const newProgress = { ...prev }
                            delete newProgress[item._id]
                            return newProgress
                        })
                    }, 500)
                }
            }, 1000)
        } catch (error) {
            console.error('Error in handleDownloadOPForm:', error)
            toast.error('Failed to generate OP Form. Please try again.', {
                hideProgressBar: true
            })
            setDownloadingOPForm(null)
            setOpFormProgress(prev => {
                const newProgress = { ...prev }
                delete newProgress[item._id]
                return newProgress
            })
        }
    }

    // Print helper: BK text only (never decorative ID-{numeric} as check-in).
    const generateQRCodeSVG = (item) => {
        try {
            const code = checkInQrPayload(item)
            if (!code) {
                return '<div style="font-size:11px;color:#64748b;">Booking ID unavailable</div>'
            }
            return `
                <div style="text-align:center;font-family:monospace;padding:12px;border:2px solid #0f172a;border-radius:8px;width:120px;">
                    <div style="font-size:9px;font-weight:700;margin-bottom:6px;">SCAN AT RECEPTION</div>
                    <div style="font-size:13px;font-weight:800;letter-spacing:0.06em;word-break:break-all;">${code}</div>
                </div>
            `
        } catch (error) {
            console.error('Error generating QR code:', error)
            return '<div>QR unavailable</div>'
        }
    }

    // Getting User Appointments Data Using API
    const getUserAppointments = async () => {
        setIsLoading(true)
        try {
            const { data } = await axios.get(backendUrl + '/api/user/appointments', { headers: { token } })

            if (!data || !data.success) {
                if (data?.message) toast.error(data.message)
                setAppointments([])
                return
            }

            if (!data.appointments || !Array.isArray(data.appointments)) {
                setAppointments([])
                return
            }

            // Sort by creation date (latest booked first)
            // Use createdAt if available, otherwise use _id (MongoDB ObjectId contains timestamp)
            const sortedAppointments = data.appointments.sort((a, b) => {
                // Try createdAt first
                if (a.createdAt && b.createdAt) {
                    return new Date(b.createdAt) - new Date(a.createdAt)
                }
                // Fallback to _id or id (handle both MongoDB and PostgreSQL)
                const idA = (a._id || a.id || '').toString()
                const idB = (b._id || b.id || '').toString()
                if (idA && idB) {
                    return idB.localeCompare(idA)
                }
                // Last resort: use slotDate + slotTime
                if (a.slotDate && b.slotDate) {
                    const dateCompare = b.slotDate.localeCompare(a.slotDate)
                    if (dateCompare !== 0) return dateCompare
                    if (a.slotTime && b.slotTime) {
                        return b.slotTime.localeCompare(a.slotTime)
                    }
                }
                return 0
            })
            setAppointments(sortedAppointments)
        } catch (error) {
            console.error('Error fetching appointments:', error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load appointments'
            toast.error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    // Function to cancel appointment Using API
    const cancelAppointment = async (appointmentId) => {
        setCancellingId(appointmentId)
        try {
            const { data } = await axios.post(backendUrl + '/api/user/cancel-appointment', { appointmentId }, { headers: { token } })

            if (data.success) {
                toast.success(data.message)
                getUserAppointments()
            } else {
                toast.error(data.message)
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error)
            const errorMessage = error?.response?.data?.message || error?.message || 'Failed to cancel appointment'
            toast.error(errorMessage)
        } finally {
            setCancellingId(null)
        }
    }


    useEffect(() => {
        if (token) {
            getUserAppointments()
        }
    }, [token])

    useEffect(() => {
        if (searchParams.get('reset') === 'true' && token) {
            setAppointmentFilter('All');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            // Refresh data to ensure "from first" view
            getUserAppointments();
            // Clear the reset parameter from the URL
            setSearchParams({});
        }
    }, [searchParams, token])

    // Refresh appointments when component mounts or when coming from payment page
    useEffect(() => {
        // Check if we're coming from a payment success redirect
        const urlParams = new URLSearchParams(window.location.search)
        const paymentSuccess = urlParams.get('paymentSuccess')

        if (paymentSuccess === 'true' && token) {
            // Small delay to ensure backend has updated
            setTimeout(() => {
                getUserAppointments()
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname)
            }, 1000)
        }
    }, [token])

    // Razorpay / checkout return: refresh list when status query is present
    useEffect(() => {
        const status = searchParams.get('status')
        const appointmentId = searchParams.get('appointmentId')
        if (!status || !token) return
        const run = async () => {
            if (status === 'success' && appointmentId) {
                toast.success('Payment return received. Refreshing your appointments…')
                getUserAppointments()
            } else if (status === 'failed') {
                toast.error('Payment was not completed. You can try again from My Appointments.')
            }
            setSearchParams({})
        }
        run()
    }, [searchParams, token])

    // Get status badge (lifecycle preferred when present)
    const getStatusBadge = (item) => {
        const label = labelForAppointment(item)
        if (label === 'Completed') {
            return <span className="badge badge-success">Completed</span>
        }
        if (label === 'Cancelled') {
            return <span className="badge badge-error">Cancelled</span>
        }
        if (label === 'Missed' || label === 'No show') {
            return <span className="badge badge-warning">{label}</span>
        }
        const life = item.lifecycleStatus || item.lifecycle_status
        if (life && label !== 'Active' && label !== 'Unknown') {
            return <span className="badge badge-info">{label}</span>
        }
        // Check payment status - payment can be true, "true", or 1
        const isPaid = item.payment === true || item.payment === "true" || item.payment === 1
        if (isPaid) {
            return <span className="badge badge-success">Payment Completed</span>
        }
        return <span className="badge badge-warning">Pending Payment</span>
    }

    // Filter appointments based on selected filter
    const filteredAppointments = appointments.filter(item => {
        if (appointmentFilter === 'All') return true;
        if (appointmentFilter === 'Pending Payment') {
            return !item.cancelled && !item.isCompleted && !(item.payment === true || item.payment === "true" || item.payment === 1);
        }
        if (appointmentFilter === 'Payment Completed') {
            return !item.cancelled && (item.payment === true || item.payment === "true" || item.payment === 1);
        }
        if (appointmentFilter === 'Cancelled') {
            return item.cancelled;
        }
        return true;
    })

    return (
        <div className="page-container fade-in">
            {/* Back Arrow Button */}
            <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
                <BackArrow className="flex-shrink-0" />
                <BackButton className="flex-grow sm:flex-grow-0" />
            </div>

            {/* Page Header */}
            <div className="section-header">
                <h1 className="section-title">My Appointments</h1>
                <p className="section-subtitle">Manage and track all your medical appointments</p>
            </div>

            {/* Filter Component */}
            {!isLoading && appointments.length > 0 && (
                <div className="mb-6">
                    <div className="inline-flex items-center bg-gray-100 rounded-full p-1 gap-1">
                        <button
                            onClick={() => setAppointmentFilter('All')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${appointmentFilter === 'All'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-700 hover:text-gray-900'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setAppointmentFilter('Pending Payment')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${appointmentFilter === 'Pending Payment'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-700 hover:text-gray-900'
                                }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            Pending Payment
                        </button>
                        <button
                            onClick={() => setAppointmentFilter('Payment Completed')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${appointmentFilter === 'Payment Completed'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-700 hover:text-gray-900'
                                }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Payment Completed
                        </button>
                        <button
                            onClick={() => setAppointmentFilter('Cancelled')}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${appointmentFilter === 'Cancelled'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-700 hover:text-gray-900'
                                }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Cancelled
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <SkeletonAppointment key={i} />
                    ))}
                </div>
            ) : appointments.length === 0 ? (
                /* Empty State */
                <div className="empty-state card">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="empty-state-title">No Appointments Yet</h3>
                    <p className="empty-state-text mb-4">
                        You haven't booked any appointments. Browse our doctors and schedule your first visit.
                    </p>
                    <button
                        onClick={() => navigate('/doctors')}
                        className="btn btn-primary"
                    >
                        Find a Doctor
                    </button>
                </div>
            ) : filteredAppointments.length === 0 ? (
                /* Empty State for Filter */
                <div className="empty-state card">
                    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="empty-state-title">No Appointments Found</h3>
                    <p className="empty-state-text mb-4">
                        No appointments match the selected filter. Try selecting a different filter option.
                    </p>
                    <button
                        onClick={() => setAppointmentFilter('All')}
                        className="btn btn-primary"
                    >
                        Show All Appointments
                    </button>
                </div>
            ) : (
                /* Appointments Grid */
                <div className="space-y-4 sm:space-y-5">
                    {filteredAppointments.map((item, index) => {
                        const isPaid = item.payment === true || item.payment === "true" || item.payment === 1
                        return (
                            <div
                                key={index}
                                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden"
                            >
                                {/* Top Section - Doctor Info & Payment Status */}
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-4 border-b border-gray-200">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1 min-w-0">
                                            {/* Doctor Avatar */}
                                            <div className="flex-shrink-0">
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl sm:text-2xl shadow-md">
                                                    {item.docData?.name ? item.docData.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'DR'}
                                                </div>
                                            </div>
                                            {/* Doctor Details */}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-gray-900 text-lg sm:text-xl mb-1 truncate">{getDoctorNameWithMD(item.docData?.name || 'Doctor', index, item.docData?.degree || item.docData?.qualification)}</h3>
                                                <p className="text-blue-600 font-medium text-sm mb-1">{item.docData?.speciality || 'General Medicine'}</p>
                                                <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                                    <div className="flex items-center gap-1">
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                        <span className="truncate max-w-[150px]">{item.docData?.address?.line1 || 'Address not available'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Status Badge - Top Right */}
                                        <div className="flex-shrink-0">
                                            {getStatusBadge(item)}
                                        </div>
                                    </div>

                                    {/* Date, Time & Token */}
                                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-200/50">
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="font-medium">{slotDateFormat(item.slotDate)} at {item.slotTime}</span>
                                        </div>
                                        {item.tokenNumber && (
                                            <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                                Token #{item.tokenNumber}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Main Content Section */}
                                <div className="p-4 sm:p-6">
                                    {/* Payment Success Details - QR Code, Token, Details - Collapsible when paid */}
                                    {!item.cancelled && isPaid && !item.isCompleted && (
                                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200/50 mb-4 overflow-hidden">
                                            {/* Header with Token Number and Toggle Button */}
                                            <div className="flex justify-between items-center p-4 sm:p-5 pb-3">
                                                <div>
                                                    <p className="text-xs text-gray-600 mb-1 font-medium">Token Number</p>
                                                    <p className="text-2xl sm:text-3xl font-bold text-blue-500">#{item.tokenNumber}</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setExpandedAppointments(prev => ({
                                                            ...prev,
                                                            [item._id]: !prev[item._id]
                                                        }))
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
                                                >
                                                    <span>{expandedAppointments[item._id] ? 'Hide' : 'Show'} Details</span>
                                                    <svg
                                                        className={`w-4 h-4 transition-transform duration-200 ${expandedAppointments[item._id] ? 'rotate-180' : ''}`}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Collapsible QR Code and Details Grid */}
                                            {expandedAppointments[item._id] && (
                                                <div className="px-4 sm:p-5 pt-0 pb-4 sm:pb-5 border-t border-green-200/50">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                        {/* QR Code */}
                                                        <div className="flex flex-col items-center sm:items-start">
                                                            <p className="text-xs text-gray-600 mb-3 font-semibold">
                                                                {item.isCompleted ? 'Visit summary QR' : 'Scan at reception'}
                                                            </p>
                                                            <div className="bg-white p-3 rounded-lg shadow-sm border-2 border-gray-200">
                                                                {generateQRData(item) ? (
                                                                <QRCode
                                                                    value={generateQRData(item)}
                                                                    size={140}
                                                                    level="H"
                                                                />
                                                                ) : (
                                                                  <p className="text-xs text-gray-500 p-4">Booking QR unavailable</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Appointment Details */}
                                                        <div className="space-y-3 text-sm">
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">Patient Name</p>
                                                                <p className="font-bold text-gray-900 text-base">{item.userData?.name || 'N/A'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">Appointment Date & Time</p>
                                                                <p className="font-bold text-gray-900">
                                                                    {slotDateFormat(item.slotDate)} at {item.slotTime}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-xs text-gray-500 mb-1">Amount Paid</p>
                                                                <p className="font-bold text-green-600 text-lg">₹{item.amount || 0}</p>
                                                            </div>
                                                            {item.docData?.address && (
                                                                <div>
                                                                    <p className="text-xs text-gray-500 mb-1">Location</p>
                                                                    <p className="font-bold text-gray-900 text-sm">
                                                                        {item.docData.address.line1}
                                                                        {item.docData.address.line2 && `, ${item.docData.address.line2}`}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Queue Tracker - Show for upcoming appointments */}
                                    {!item.cancelled && !item.isCompleted && isPaid && (
                                        <div className="mb-4">
                                            <QueueTracker
                                                appointmentId={item._id}
                                                docId={item.docId}
                                                slotDate={item.slotDate}
                                                slotTime={item.slotTime}
                                                isExpanded={expandedQueueStatus[item._id] || false}
                                                onToggle={() => {
                                                    setExpandedQueueStatus(prev => ({
                                                        ...prev,
                                                        [item._id]: !prev[item._id]
                                                    }))
                                                }}
                                                onTokenAlert={(tokenNumber) => {
                                                    toast.success(`🎯 Token #${tokenNumber} - Your turn is next!`, {
                                                        autoClose: 10000,
                                                        position: "top-center"
                                                    })
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                                        {/* Completed Status */}
                                        {item.isCompleted && (
                                            <button className="btn btn-success w-full" disabled>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Completed
                                            </button>
                                        )}

                                        {/* Cancelled Status */}
                                        {item.cancelled && !item.isCompleted && (
                                            <button className="btn btn-danger w-full" disabled>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Cancelled
                                            </button>
                                        )}

                                        {/* Payment Options - Pay Online/Pay on Visit Button (Show for unpaid appointments only) */}
                                        {!item.cancelled && !isPaid && !item.isCompleted && (
                                            <>
                                                <button
                                                    onClick={() => handlePayOnline(item)}
                                                    disabled={payOnlineLoadingId === item._id}
                                                    className="btn btn-primary flex-1"
                                                >
                                                    {payOnlineLoadingId === item._id ? (
                                                        <>
                                                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                                            Opening Razorpay...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                            </svg>
                                                            Complete Payment
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadOPForm(item)}
                                                    disabled={downloadingOPForm === item._id}
                                                    className="btn btn-secondary flex-1"
                                                >
                                                    {downloadingOPForm === item._id ? (
                                                        <span className="font-semibold">
                                                            {opFormProgress[item._id] || 1}%
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            OP Form
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => cancelAppointment(item._id)}
                                                    disabled={cancellingId === item._id}
                                                    className="btn btn-outline-danger flex-1"
                                                >
                                                    {cancellingId === item._id ? (
                                                        <ButtonSpinner />
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            Cancel
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}

                                        {/* Paid Status - video consult, OP form, cancel */}
                                        {!item.cancelled && isPaid && !item.isCompleted && (
                                            <>
                                                {isOnlineVideoAppointment(item) && (
                                                    <button
                                                        onClick={() => navigate(`/video-consult/${item._id}`)}
                                                        className="btn btn-primary flex-1"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                        Join video call
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDownloadOPForm(item)}
                                                    disabled={downloadingOPForm === item._id}
                                                    className="btn btn-secondary flex-1"
                                                >
                                                    {downloadingOPForm === item._id ? (
                                                        <span className="font-semibold">
                                                            {opFormProgress[item._id] || 1}%
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                            </svg>
                                                            OP Form
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => cancelAppointment(item._id)}
                                                    disabled={cancellingId === item._id}
                                                    className="btn btn-outline-danger flex-1"
                                                >
                                                    {cancellingId === item._id ? (
                                                        <ButtonSpinner />
                                                    ) : (
                                                        <>
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            Cancel
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                appointment={selectedAppointmentForPayment}
                onRazorpayPayment={onRazorpayPayment}
                onPayAtClinic={() => {
                    toast.info('This appointment is already scheduled for Pay at Clinic.')
                    setShowPaymentModal(false)
                }}
                isProcessing={isPaymentProcessing}
            />
        </div>
    )
}

export default MyAppointments

