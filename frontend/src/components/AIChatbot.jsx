import React, { useState, useRef, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const AIChatbot = ({ onClose }) => {
    const { backendUrl, token, doctors } = useContext(AppContext);
    const navigate = useNavigate();
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: "Hello! I'm MedClues AI. How can I help you today?"
        }
    ]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState('find_doctor');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Prevent background scrolling when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    const sendChatMessage = async (userMessage) => {
        setIsLoading(true);

        try {
            if (!backendUrl) {
                throw new Error('Backend URL is not configured. Please set VITE_BACKEND_URL in .env file');
            }

            // Create a blank assistant message that we will append chunks to
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            const response = await fetch(`${backendUrl}/api/ai/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userMessage,
                    userId: token || null
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get streaming response from backend');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                lines.forEach(rawLine => {
                    const line = rawLine.trim();
                    if (!line) return;

                    try {
                        const cleanLine = line.startsWith('data: ') ? line.replace('data: ', '').trim() : line;
                        if (cleanLine === '[DONE]') return;
                        
                        const parsed = JSON.parse(cleanLine);
                        if (parsed.type === 'content' && parsed.data) {
                            accumulatedContent += parsed.data;
                            setMessages(prev => {
                                const copy = [...prev];
                                if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                                    copy[copy.length - 1].content = accumulatedContent;
                                }
                                return copy;
                            });
                        } else if (parsed.content) {
                            accumulatedContent += parsed.content;
                            setMessages(prev => {
                                const copy = [...prev];
                                if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                                    copy[copy.length - 1].content = accumulatedContent;
                                }
                                return copy;
                            });
                        }
                    } catch (e) {
                        // If parsing failed but it's raw text, append it as a backup
                        if (!line.includes('{') && !line.startsWith('data:')) {
                            accumulatedContent += line + '\n';
                            setMessages(prev => {
                                const copy = [...prev];
                                if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                                    copy[copy.length - 1].content = accumulatedContent;
                                }
                                return copy;
                            });
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => {
                const copy = [...prev];
                if (copy.length > 0 && copy[copy.length - 1].role === 'assistant' && !copy[copy.length - 1].content) {
                    copy[copy.length - 1].content = "We apologize for the inconvenience. Our AI assistant is temporarily unavailable. Please try again in a moment.";
                } else if (copy.length > 0 && copy[copy.length - 1].role === 'assistant') {
                    // Keep the content we managed to get, don't delete it
                } else {
                    copy.push({
                        role: 'assistant',
                        content: "We apologize for the inconvenience. Our AI assistant is temporarily unavailable. Please try again in a moment."
                    });
                }
                return copy;
            });
            toast.error('Failed to get AI response');
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();

        if (!inputMessage.trim() || isLoading) return;

        const userMessage = inputMessage.trim();
        setInputMessage('');

        // Add user message to chat first
        const newUserMessage = {
            role: 'user',
            content: userMessage
        };
        setMessages(prev => [...prev, newUserMessage]);

        await sendChatMessage(userMessage);
    };

    const handleSuggestedActions = (actions) => {
        // Keeps compatibility but inactive
    };

    // Handle explicit navigation when user clicks a button
    const handleActionClick = (action) => {
        if (action.action === 'navigate_to_doctors') {
            navigate('/hospitals');
            if (onClose) onClose();
            return;
        }

        if (action.type === 'book_appointment' || action.type === 'navigate_to_doctor') {
            const doctorId = action.doctorId || action.action?.split('/').pop();
            if (doctorId && doctorId !== 'navigate_to_doctors') {
                navigate(`/appointment/${doctorId}`);
                if (onClose) onClose();
            } else {
                navigate('/hospitals');
                if (onClose) onClose();
            }
        } else if (action.type === 'view_specialty') {
            navigate(`/doctors/${action.action.split('/')[1]}`);
            if (onClose) onClose();
        } else if (action.type === 'view_doctors') {
            navigate('/hospitals');
            if (onClose) onClose();
        } else if (action.type === 'show_slots' && action.doctorId) {
            fetchMoreSlots(action.doctorId);
        }
    };

    // Handle slot selection
    const handleSlotSelection = (doctorId, slotDate, slotTime, doctorName) => {
        if (!token) {
            toast.warning('Please log in to book an appointment');
            navigate('/login');
            return;
        }

        navigate(`/appointment/${doctorId}?date=${slotDate}&time=${slotTime}`);
        if (onClose) onClose();
        toast.success(`Redirecting to book with ${doctorName}...`);
    };

    // Fetch more slots for a doctor
    const fetchMoreSlots = async (doctorId) => {
        try {
            const { data } = await axios.get(
                `${backendUrl}/api/ai/doctor-slots/${doctorId}`
            );

            if (data.success && data.availableSlots.length > 0) {
                const slotsMessage = {
                    role: 'assistant',
                    content: `Here are all available slots for ${data.doctor.name}:`,
                    bookingData: {
                        doctorId: data.doctor.id,
                        doctorName: data.doctor.name,
                        specialty: data.doctor.speciality,
                        fees: data.doctor.fees,
                        availableSlots: data.availableSlots
                    }
                };
                setMessages(prev => [...prev, slotsMessage]);
            }
        } catch (error) {
            console.error('Error fetching slots:', error);
            toast.error('Failed to fetch available slots');
        }
    };

    const handleQuickAction = async (action) => {
        setActiveTab(action);
        const quickMessages = {
            'find_doctor': 'I need help finding a doctor',
            'book_appointment': 'I want to book an appointment',
            'view_specialties': 'What specialties do you have?',
            'pricing': 'What are the consultation fees?'
        };

        const message = quickMessages[action];
        if (!message) return;

        // Add user message to chat first
        const newUserMessage = {
            role: 'user',
            content: message
        };
        setMessages(prev => [...prev, newUserMessage]);

        await sendChatMessage(message);
    };

    if (isMinimized) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal">
                <button
                    onClick={() => setIsMinimized(false)}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full p-3.5 shadow-lg hover:shadow-xl transition-all hover:scale-110"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                </button>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-modal p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget && onClose) {
                    onClose();
                }
            }}
            style={{ overflow: 'hidden' }}
        >
            <div
                className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200"
                style={{
                    maxHeight: 'calc(100vh - 2rem)',
                    height: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between shadow-lg flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/25 rounded-full flex items-center justify-center shadow-md relative">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <svg className="w-4 h-4 text-white absolute -top-0.5 -right-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v8m4-4H8" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold leading-tight tracking-tight">MedClues AI</h3>
                            <p className="text-sm text-white font-medium leading-tight mt-0.5">Your healthcare assistant</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="text-white/80 hover:text-white transition-colors p-1"
                                title="Close"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="px-4 py-2 bg-white border-b border-gray-200 flex gap-0 flex-shrink-0">
                    <button
                        onClick={() => handleQuickAction('find_doctor')}
                        className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'find_doctor'
                                ? 'text-cyan-600 border-cyan-600 bg-cyan-50/50'
                                : 'text-gray-600 border-transparent hover:text-cyan-600 hover:border-cyan-300'
                            }`}
                    >
                        Find Doctor
                    </button>
                    <button
                        onClick={() => handleQuickAction('book_appointment')}
                        className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'book_appointment'
                                ? 'text-cyan-600 border-cyan-600 bg-cyan-50/50'
                                : 'text-gray-600 border-transparent hover:text-cyan-600 hover:border-cyan-300'
                            }`}
                    >
                        Book Appointment
                    </button>
                    <button
                        onClick={() => handleQuickAction('view_specialties')}
                        className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'view_specialties'
                                ? 'text-cyan-600 border-cyan-600 bg-cyan-50/50'
                                : 'text-gray-600 border-transparent hover:text-cyan-600 hover:border-cyan-300'
                            }`}
                    >
                        Specialties
                    </button>
                </div>

                {/* Messages */}
                <div
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
                    style={{
                        maxHeight: 'calc(100vh - 400px)',
                        minHeight: '200px',
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}
                >
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {/* Avatar for AI messages */}
                            {message.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0 relative">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    <svg className="w-3 h-3 text-white absolute -top-0.5 -right-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v8m4-4H8" />
                                    </svg>
                                </div>
                            )}

                            <div
                                className={`max-w-[75%] rounded-xl px-4 py-3 shadow-sm ${message.role === 'user'
                                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-tr-sm'
                                        : 'bg-white border-2 border-gray-200 text-gray-900 rounded-tl-sm'
                                    }`}
                            >
                                <div className={`whitespace-pre-wrap leading-relaxed text-sm ${message.role === 'user' ? 'text-white font-medium' : 'text-gray-900 font-normal'
                                    }`}>
                                    {message.content ? message.content.split('\n').map((line, idx) => {
                                        const trimmedLine = line.trim();

                                        // Format markdown-style headers (**text**) - Highlight in blue for medical
                                        if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                                            const headerText = trimmedLine.replace(/\*\*/g, '');
                                            const isImportant = ['Simple Explanation', 'When to See a Doctor', 'Disclaimer'].includes(headerText);
                                            return (
                                                <div key={idx} className={`font-bold text-base mt-4 mb-2 ${isImportant ? 'text-blue-600' : 'text-gray-900'
                                                    }`}>
                                                    {headerText}
                                                </div>
                                            );
                                        }
                                        // Format bullet points - Highlight medicines and important info
                                        if (trimmedLine.startsWith('•')) {
                                            const isMedicine = trimmedLine.toLowerCase().includes('medicine') ||
                                                trimmedLine.toLowerCase().includes('paracetamol') ||
                                                trimmedLine.toLowerCase().includes('ibuprofen') ||
                                                trimmedLine.toLowerCase().includes('antacid') ||
                                                trimmedLine.toLowerCase().includes('cough') ||
                                                trimmedLine.toLowerCase().includes('syrup') ||
                                                trimmedLine.toLowerCase().includes('nasal') ||
                                                trimmedLine.toLowerCase().includes('calamine') ||
                                                trimmedLine.toLowerCase().includes('simethicone');
                                            const isImportant = trimmedLine.toLowerCase().includes('see a doctor') ||
                                                trimmedLine.toLowerCase().includes('emergency') ||
                                                trimmedLine.toLowerCase().includes('consult');

                                            // Extract medicine name from line (format: "• Medicine Name – purpose")
                                            const medicineMatch = trimmedLine.match(/•\s*([^–]+)/);
                                            const medicineName = medicineMatch ? medicineMatch[1].trim() : null;

                                            // Check if this medicine has purchase links
                                            const medicineData = message.medicalData?.medicines?.find(m =>
                                                medicineName && medicineName.toLowerCase().includes(m.name.toLowerCase())
                                            );

                                            return (
                                                <div key={idx} className={`ml-4 mb-2 ${isMedicine ? 'text-green-700 font-semibold' :
                                                        isImportant ? 'text-red-600 font-semibold' :
                                                            'text-gray-700'
                                                    }`}>
                                                    <div>{line}</div>
                                                    {medicineData && medicineData.links && Object.keys(medicineData.links).length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                                            <span className="text-gray-600">Buy:</span>
                                                            {medicineData.links.pharmeasy && (
                                                                <a
                                                                    href={medicineData.links.pharmeasy}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    PharmEasy
                                                                </a>
                                                            )}
                                                            {medicineData.links['1mg'] && (
                                                                <a
                                                                    href={medicineData.links['1mg']}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    1mg
                                                                </a>
                                                            )}
                                                            {medicineData.links.netmeds && (
                                                                <a
                                                                    href={medicineData.links.netmeds}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    Netmeds
                                                                </a>
                                                            )}
                                                            {medicineData.links.amazon && (
                                                                <a
                                                                    href={medicineData.links.amazon}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    Amazon
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        // Regular text - Keep it simple
                                        return (
                                            <div key={idx} className="mb-1 text-gray-700">
                                                {line}
                                            </div>
                                        );
                                    }) : ''}
                                </div>

                                {/* Medical Data Display */}
                                {message.medicalData && (
                                    <div className="mt-3 space-y-2 pt-3 border-t border-gray-200">
                                        {message.medicalData.severity && (
                                            <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${message.medicalData.severity === 'Critical' || message.medicalData.severity === 'High'
                                                    ? 'bg-red-100 text-red-700'
                                                    : message.medicalData.severity === 'Moderate'
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-green-100 text-green-700'
                                                }`}>
                                                Severity: {message.medicalData.severity}
                                            </div>
                                        )}

                                        {message.medicalData.possible_conditions && message.medicalData.possible_conditions.length > 0 && (
                                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                                                <p className="text-xs font-semibold text-blue-900 mb-2">Possible Conditions:</p>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {message.medicalData.possible_conditions.map((condition, idx) => (
                                                        <li key={idx} className="text-xs text-blue-800">{condition}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {message.medicalData.suggested_medicines && message.medicalData.suggested_medicines.length > 0 && (
                                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                                <p className="text-xs font-semibold text-green-900 mb-2">Suggested OTC Medicines:</p>
                                                <ul className="list-disc list-inside space-y-1">
                                                    {message.medicalData.suggested_medicines.map((medicine, idx) => (
                                                        <li key={idx} className="text-xs text-green-800">{medicine}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {message.medicalData.status === 'awaiting_details' && (
                                            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                                <p className="text-xs font-semibold text-yellow-900">⚠️ Please provide more details</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Booking Data - Available Slots */}
                                {message.bookingData && message.bookingData.availableSlots && (
                                    <div className="mt-1.5 space-y-1.5">
                                        {/* Doctor Info */}
                                        <div className="bg-white/50 rounded-lg p-1.5 border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-[10px]">
                                                        Dr. {message.bookingData.doctorName}
                                                    </p>
                                                    <p className="text-[9px] text-gray-700 font-medium">
                                                        {message.bookingData.specialty}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-cyan-600 text-[10px]">
                                                        ₹{message.bookingData.fees}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Available Slots */}
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-semibold text-gray-900">Available Appointment Slots:</p>
                                            {message.bookingData.availableSlots.slice(0, 2).map((daySlot, dayIdx) => (
                                                <div key={dayIdx} className="bg-white/50 rounded-lg p-1.5 border border-gray-200">
                                                    <p className="text-[9px] font-semibold text-gray-900 mb-1">
                                                        {daySlot.displayDate}
                                                    </p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {daySlot.slots.slice(0, 3).map((slot, slotIdx) => (
                                                            <button
                                                                key={slotIdx}
                                                                onClick={() => handleSlotSelection(
                                                                    message.bookingData.doctorId,
                                                                    slot.date,
                                                                    slot.time,
                                                                    message.bookingData.doctorName
                                                                )}
                                                                className="px-2 py-1 text-[9px] font-medium bg-cyan-500 hover:bg-cyan-600 text-white rounded transition-colors"
                                                            >
                                                                {slot.displayTime}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Book Button */}
                                        <button
                                            onClick={() => navigate(`/appointment/${message.bookingData.doctorId}`)}
                                            className="w-full px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-[10px] font-semibold rounded-lg transition-all shadow-sm"
                                        >
                                            Book Appointment →
                                        </button>
                                    </div>
                                )}

                                {/* Suggested Actions */}
                                {message.suggestedActions && message.suggestedActions.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {message.suggestedActions.map((action, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleActionClick(action)}
                                                className="block w-full text-left px-2.5 py-1 text-[9px] font-medium bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded transition-colors text-cyan-700"
                                            >
                                                {action.label} →
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Avatar for user messages */}
                            {message.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3 justify-start">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0 relative">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <svg className="w-3 h-3 text-white absolute -top-0.5 -right-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v8m4-4H8" />
                                </svg>
                            </div>
                            <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="px-4 py-3 border-t bg-white rounded-b-2xl flex-shrink-0">
                    <div className="flex gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-gray-900 placeholder-gray-500"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!inputMessage.trim() || isLoading}
                            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center font-medium"
                        >
                            Send
                        </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-center font-medium">
                        Powered by MedClues AI • For informational purposes only • Not a substitute for professional medical advice
                    </p>
                </form>
            </div>
        </div>
    );
};

export default AIChatbot;

