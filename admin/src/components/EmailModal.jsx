import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';

const EmailModal = ({ isOpen, onClose, patientEmail, patientName, appointment, backendUrl, aToken }) => {
    const [subject, setSubject] = useState('MedClues Appointment Update');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    React.useEffect(() => {
        if (isOpen && appointment) {
            // Pre-fill message with default template
            const defaultMessage = `Hello ${patientName || 'Patient'},

This is MedClues Hospital regarding your appointment on ${appointment.slotDate} at ${appointment.slotTime}.

${appointment.docData?.name ? `Doctor: Dr. ${appointment.docData.name}` : ''}
${appointment.docData?.speciality ? `Specialty: ${appointment.docData.speciality}` : ''}

Regards,
MedClues Team`;
            setMessage(defaultMessage);
        }
    }, [isOpen, appointment, patientName]);

    const handleSend = async () => {
        if (!patientEmail) {
            toast.error('Patient email not available');
            return;
        }

        if (!subject.trim() || !message.trim()) {
            toast.error('Please fill in both subject and message');
            return;
        }

        setSending(true);
        try {
            const response = await axios.post(
                `${backendUrl}/api/admin/send-email`,
                {
                    patientEmail,
                    patientName,
                    subject,
                    message,
                    appointment: {
                        slotDate: appointment?.slotDate,
                        slotTime: appointment?.slotTime,
                        docData: appointment?.docData
                    }
                },
                { headers: { aToken } }
            );

            if (response.data.success) {
                toast.success('Email sent successfully!');
                onClose();
                setSubject('MedClues Appointment Update');
                setMessage('');
            } else {
                toast.error(response.data.message || 'Failed to send email');
            }
        } catch (error) {
            console.error('Error sending email:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to send email. Please check email configuration.';
            toast.error(errorMessage);
            
            // Log detailed error for debugging
            if (error.response?.data?.message?.includes('password') || error.response?.data?.message?.includes('credentials')) {
                console.error('Email configuration error. Please ensure EMAIL_APP_PASSWORD or BREVO_* is set in fastapi_back/.env');
            }
        } finally {
            setSending(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 pt-12" style={{ backdropFilter: 'blur(2px)' }}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-[800px] flex flex-col" style={{ maxHeight: '75vh' }}>
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
                    <div className="flex-1 min-w-0 pr-4">
                        <h2 className="text-xl font-bold mb-1">Send Email</h2>
                        <p className="text-sm opacity-90 truncate">To: {patientEmail || 'N/A'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors flex-shrink-0"
                        style={{ width: '36px', height: '36px' }}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                            placeholder="Email subject"
                            style={{ fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Message
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            rows={7}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all text-sm"
                            placeholder="Enter your message here..."
                            style={{ fontSize: '14px', lineHeight: '1.5' }}
                        />
                    </div>

                    <div className="bg-blue-50 border-l-4 border-blue-400 rounded-md p-3">
                        <p className="text-xs text-blue-800 leading-relaxed">
                            <strong>Note:</strong> This email is sent by the server using configured Brevo/Gmail SMTP
                            (inbox/support address from <code>SUPPORT_EMAIL</code>, default <strong>support@medclues.com</strong>).
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-lg border-t border-gray-200 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || !patientEmail}
                        className="px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {sending ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Sending...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Send Email
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailModal;

