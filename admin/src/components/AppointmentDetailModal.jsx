import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { getPatientName, getPatientAge, getPatientImage } from '../utils/appointmentDisplay';
import { isOnlineVideoAppointment } from '../utils/videoConsult';
import PatientReportsViewer from './PatientReportsViewer';
import DoctorPatientHistoryModal from './DoctorPatientHistoryModal';

import { labelForAppointment } from '../utils/lifecycleLabels';

const getReason = (appointment) => {
    const raw = appointment.selectedSymptoms || [];
    const symptoms = raw.filter((s) => !String(s).startsWith('Note:'));
    if (symptoms.length > 0) return symptoms;
    const note = raw.find((s) => String(s).startsWith('Note:'));
    if (note) return [String(note).replace(/^Note:\s*/, '')];
    return [];
};

const statusMeta = (appointment) => {
    const label = labelForAppointment(appointment);
    if (label === 'Cancelled') return { label, cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' };
    if (label === 'Completed') return { label, cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' };
    if (label === 'Missed' || label === 'No show') return { label, cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' };
    return { label, cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' };
};

const InfoTile = ({ label, value, accent = 'text-slate-900' }) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">{label}</p>
        <p className={`text-sm font-semibold ${accent}`}>{value}</p>
    </div>
);

const AppointmentDetailModal = ({ appointment, onClose }) => {
    const { slotDateFormat, calculateAge, currency } = useContext(AppContext);
    const [showReports, setShowReports] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    if (!appointment) return null;

    const status = statusMeta(appointment);
    const video = isOnlineVideoAppointment(appointment);
    const reasons = getReason(appointment);
    const patientName = getPatientName(appointment);
    const phone = appointment.userData?.phone || appointment.actualPatient?.phone;
    const email = appointment.userData?.email;

    return (
        <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full relative animate-scale-in overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
                style={{ maxHeight: '92vh' }}
            >
                {/* Corporate header band */}
                <div className="relative bg-gradient-to-r from-slate-800 to-slate-700 px-5 sm:px-6 py-5">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <p className="text-[11px] uppercase tracking-widest text-white/60 font-semibold">Appointment Record</p>
                    <div className="flex items-center gap-4 mt-3">
                        <img
                            src={getPatientImage(appointment)}
                            className="w-14 h-14 rounded-full object-cover ring-2 ring-white/30 shrink-0"
                            alt={patientName}
                        />
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-white truncate">{patientName}</h2>
                            <p className="text-sm text-white/70">
                                {getPatientAge(appointment, calculateAge) || '—'} yrs
                                {appointment.userData?.gender ? ` · ${appointment.userData.gender}` : ''}
                            </p>
                        </div>
                        <span className={`ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${status.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </span>
                    </div>
                </div>

                <div className="p-5 sm:p-6 overflow-y-auto">
                    {/* Mobile status */}
                    <span className={`sm:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 mb-4 ${status.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                    </span>

                    {/* Contact row */}
                    {(phone || email) && (
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-5 text-sm text-slate-600">
                            {phone && (
                                <span className="inline-flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    {phone}
                                </span>
                            )}
                            {email && (
                                <span className="inline-flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    {email}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                        <InfoTile label="Date" value={slotDateFormat(appointment.slotDate)} />
                        <InfoTile label="Time" value={appointment.slotTime || '—'} />
                        <InfoTile label="Consultation" value={video ? 'Video Call' : 'In Clinic'} accent={video ? 'text-blue-600' : 'text-emerald-600'} />
                        <InfoTile label="Token" value={appointment.tokenNumber ? `#${appointment.tokenNumber}` : '—'} />
                        <InfoTile label="Payment" value={appointment.payment ? 'Paid Online' : 'Pay at Visit'} accent={appointment.payment ? 'text-emerald-600' : 'text-amber-600'} />
                        <InfoTile label="Fee" value={`${currency}${appointment.amount ?? 0}`} />
                    </div>

                    {appointment.bookingId && (
                        <p className="text-xs text-slate-400 mb-5">Booking ID: <span className="font-mono text-slate-500">{appointment.bookingId}</span></p>
                    )}

                    {/* Reason / symptoms */}
                    <div className="mb-5">
                        <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Reason for Visit</p>
                        {reasons.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {reasons.map((r, i) => (
                                    <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">{r}</span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">General consultation</p>
                        )}
                    </div>

                    {/* Patient history & reports */}
                    <div className="mb-2 space-y-2">
                        <button
                            onClick={() => setShowHistory(true)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-semibold text-sm text-indigo-900">Past Visits &amp; Prescriptions</span>
                            </span>
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setShowReports(!showReports)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
                        >
                            <span className="flex items-center gap-2.5">
                                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="font-semibold text-sm text-slate-800">Patient Reports &amp; Documents</span>
                            </span>
                            <svg className={`w-4 h-4 text-slate-500 transition-transform ${showReports ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showReports && (
                            <div className="mt-4">
                                <PatientReportsViewer
                                    appointmentId={appointment._id}
                                    patientName={patientName}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/60">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors text-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
            <DoctorPatientHistoryModal
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                appointmentId={appointment._id}
                patientName={patientName}
            />
        </div>
    );
};

export default AppointmentDetailModal;
