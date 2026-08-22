import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Home, ShieldCheck, Printer, Share2, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import QRCode from 'react-qr-code';
import html2pdf from 'html2pdf.js';
import { toast } from 'react-toastify';
import { checkInQrPayload, verifyAppointmentUrl } from '../utils/bookingQr';

const AppointmentConfirmation = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const cardRef = useRef(null);
    const { appointmentData } = location.state || {};

    // Helper to format values safely
    const formatValue = (val) => {
        if (!val) return 'N/A';
        if (typeof val === 'string') return val;
        if (typeof val === 'object') {
            if (val.line1) return `${val.line1}${val.line2 ? `, ${val.line2}` : ''}`;
            if (val.city) return `${val.line1 || ''} ${val.city}`;
            return JSON.stringify(val);
        }
        return String(val);
    };

    // Fallback data
    const data = appointmentData || {
        patientName: "Rahul Kumar",
        providerName: "Dr. Sharma",
        providerType: "doctor",
        service: "General Checkup",
        date: "12 March 2026",
        time: "10:30 AM",
        location: "MedClues Clinic, Road No. 12, Banjara Hills",
        id: "MCN-483920"
    };

    const qrValue =
        data.qrData ||
        checkInQrPayload(data) ||
        verifyAppointmentUrl(data.id) ||
        String(data.id || '');

    // ACTION: Download as PDF
    const handleDownload = () => {
        const element = cardRef.current;
        const opt = {
            margin: 0.2,
            filename: `MedClues_AdmitCard_${data.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
        };
        
        toast.info("Generating your admit card PDF...");
        html2pdf().from(element).set(opt).save().then(() => {
            toast.success("Download complete!");
        }).catch(err => {
            console.error("PDF Error:", err);
            toast.error("Failed to generate PDF");
        });
    };

    // ACTION: Print
    const handlePrint = () => {
        window.print();
    };

    // ACTION: Share
    const handleShare = async () => {
        const shareData = {
            title: 'MedClues Appointment Pass',
            text: `My appointment with ${data.providerName} is confirmed for ${data.date} at ${data.time}. ID: ${data.id}`,
            url: window.location.href
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                toast.success("Details copied to clipboard!");
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white relative overflow-hidden py-12 px-6">
            {/* Print-only CSS */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    .print-container { 
                        display: flex !important; 
                        justify-content: center !important; 
                        align-items: flex-start !important;
                        padding-top: 20px !important;
                    }
                    #admit-card-to-print {
                        box-shadow: none !important;
                        border: 1px solid #eee !important;
                        width: 850px !important;
                        margin: 0 auto !important;
                    }
                }
            ` }} />

            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl opacity-20 pointer-events-none no-print">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-400 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-400 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-4xl w-full z-10 print-container">
                {/* Horizontal Admit Card */}
                <motion.div 
                    ref={cardRef}
                    id="admit-card-to-print"
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", damping: 20, stiffness: 100 }}
                    className="bg-white rounded-3xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] border border-gray-100 overflow-hidden flex flex-col sm:flex-row relative min-h-[400px]"
                >
                    {/* Left Column - Official Header */}
                    <div className="bg-gradient-to-b from-blue-900 to-slate-900 text-white p-8 sm:w-[240px] flex flex-col justify-between relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
                        
                        <div className="relative flex flex-col items-center sm:items-start text-center sm:text-left transition-all duration-500">
                            <span className="text-[10px] font-black tracking-[0.4em] text-blue-400 mb-2 uppercase">Verified Ticket</span>
                            <h1 className="text-2xl font-black tracking-tight text-white mb-1">MedClues</h1>
                            <p className="text-[10px] font-bold text-blue-200/60 uppercase tracking-widest leading-relaxed">Official Appointment Pass</p>
                        </div>

                        <div className="relative mt-8 pt-8 border-t border-white/5 space-y-4 hidden sm:block">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Security Status</span>
                                <span className="text-[10px] font-bold text-slate-300">FULLY PROTECTED</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Booking State</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-bold text-slate-300 uppercase">Confirmed</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Body & QR area */}
                    <div className="flex-1 flex flex-col relative bg-white">
                        {/* Status Ribbon (Horizontal Top) */}
                        <div className="bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-[10px] font-black py-2.5 px-8 flex items-center gap-2 uppercase tracking-[0.2em]">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Booking Successfully Confirmed
                        </div>

                        {/* Card-Internal Close Button */}
                        <div className="absolute top-2 right-2 z-50 no-print">
                            <motion.button
                                whileHover={{ scale: 1.1, rotate: 90 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => navigate('/')}
                                className="w-8 h-8 flex items-center justify-center bg-white/50 backdrop-blur-sm border border-slate-100 rounded-full shadow-sm hover:bg-white transition-all text-slate-400 hover:text-red-500"
                                title="Close and return to Dashboard"
                            >
                                <X size={16} strokeWidth={3} />
                            </motion.button>
                        </div>

                        <div className="flex flex-col md:flex-row flex-1">
                            {/* Body Information Section */}
                            <div className="flex-1 p-8 relative border-r border-slate-50">
                                {/* Subtle Logo Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none rotate-12">
                                    <h2 className="text-[12rem] font-black">Medic</h2>
                                </div>

                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">Patient & Provider Details</h3>

                                {/* Information Matrix */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 relative z-10">
                                    {[
                                        { label: 'Patient Name', value: data.patientName, bold: true },
                                        { label: 'Booking ID', value: data.id, fontMono: true },
                                        { label: data.providerType === 'lab' ? 'Medical Center' : 'Consulting Doctor', value: data.providerName, bold: true },
                                        { label: 'Visit Location', value: data.location, compact: true },
                                        { label: 'Service Type', value: data.service },
                                        { label: 'Appointment Time', value: `${data.date} at ${data.time}`, highlight: true },
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex flex-col border-b border-slate-100 pb-3 transition-colors hover:border-blue-100 group">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 group-hover:text-blue-400">{item.label}</span>
                                            <span className={`text-sm ${item.highlight ? 'text-blue-600 font-extrabold' : item.bold ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'} ${item.fontMono ? 'font-mono' : ''} ${item.compact ? 'leading-tight text-xs' : ''}`}>
                                                {formatValue(item.value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Technical Check-in Area */}
                            <div className="w-full md:w-[240px] p-8 flex flex-col items-center justify-center bg-slate-50/20">
                                <div className="bg-white p-5 rounded-[2.5rem] shadow-xl shadow-blue-900/5 border border-slate-100 mb-6 transform hover:scale-105 transition-all duration-500">
                                    <QRCode 
                                        value={qrValue} 
                                        size={120} 
                                        level="H"
                                        fgColor="#1e293b"
                                    />
                                </div>
                                
                                <div className="text-center space-y-2">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.1em]">Show at Reception</p>
                                    <p className="text-[9px] font-semibold text-slate-400 leading-relaxed uppercase tracking-wider max-w-[140px]">
                                        Please bring a valid ID for verification at check-in.
                                    </p>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 w-full flex justify-center opacity-20">
                                    <ShieldCheck size={28} className="text-blue-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Edge Cutouts */}
                    <div className="absolute left-[240px] -top-3 w-6 h-6 bg-white rounded-full border-b border-gray-100 no-print hidden sm:block"></div>
                    <div className="absolute left-[240px] -bottom-3 w-6 h-6 bg-white rounded-full border-t border-gray-100 no-print hidden sm:block"></div>
                </motion.div>

                {/* Extended UI Actions */}
                <div className="mt-10 no-print flex flex-col sm:flex-row gap-4">
                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#1d4ed8' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleDownload}
                        className="flex-[2] h-14 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-[0_20px_40px_-15px_rgba(37,99,235,0.3)] flex items-center justify-center gap-3 transition-all"
                    >
                        <Download size={20} className="animate-pulse" />
                        GET DIGITAL PASS (PDF)
                    </motion.button>
                    
                    <button 
                        onClick={handlePrint}
                        className="flex-1 h-14 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <Printer size={18} className="group-hover:text-blue-500 transition-colors" /> Print Slab
                    </button>
                    
                    <button 
                        onClick={handleShare}
                        className="flex-1 h-14 rounded-2xl bg-white border border-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm group"
                    >
                        <Share2 size={18} className="group-hover:text-cyan-500 transition-colors" /> Share Vector
                    </button>
                </div>

                <div className="mt-12 flex justify-center no-print">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/')}
                        className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold text-[11px] uppercase tracking-[0.3em] hover:bg-blue-300 hover:text-white transition-all shadow-sm border border-slate-200"
                    >
                        <Home size={14} />
                        Return to Official Dashboard
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentConfirmation;
