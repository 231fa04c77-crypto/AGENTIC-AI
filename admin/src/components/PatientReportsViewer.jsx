import React, { useState, useEffect, useContext } from 'react';
import { DoctorContext } from '../context/DoctorContext';
import { AppContext } from '../context/AppContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const PatientReportsViewer = ({ appointmentId, patientName }) => {
    const { backendUrl, dToken } = useContext(DoctorContext);
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showViewer, setShowViewer] = useState(false);

    useEffect(() => {
        if (appointmentId) {
            fetchPatientRecords();
        }
    }, [appointmentId]);

    const fetchPatientRecords = async () => {
        setIsLoading(true);
        try {
            const { data } = await axios.get(
                `${backendUrl}/api/doctor/patient-records/${appointmentId}`,
                { headers: { dToken } }
            );

            if (data.success) {
                setRecords(data.records);
            }
        } catch (error) {
            console.error('Failed to fetch patient records:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const markAsViewed = async (recordId) => {
        try {
            const { data } = await axios.post(
                `${backendUrl}/api/doctor/patient-records/${recordId}/viewed`,
                {},
                { headers: { dToken } }
            );

            if (data.success) {
                // Update local state
                setRecords(prev => prev.map(record => 
                    record._id === recordId 
                        ? { ...record, viewedByDoctor: true, viewedAt: new Date() }
                        : record
                ));
            }
        } catch (error) {
            console.error('Failed to mark as viewed:', error);
        }
    };

    const openViewer = (record) => {
        setSelectedRecord(record);
        setShowViewer(true);
        if (!record.viewedByDoctor) {
            markAsViewed(record._id);
        }
    };

    const downloadFile = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'medical-report';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback: try opening in new tab
            window.open(url, '_blank');
        }
    };

    const getRecordIcon = (type) => {
        const icons = {
            prescription: '💊',
            lab_report: '🧪',
            xray: '📷',
            scan: '🔬',
            vaccination: '💉',
            medical_note: '📝',
            other: '📄'
        };
        return icons[type] || '📄';
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    if (isLoading) {
        return (
            <div className="p-4 bg-white rounded-lg border">
                <p className="text-sm text-gray-500">Loading patient reports...</p>
            </div>
        );
    }

    if (records.length === 0) {
        return (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No reports uploaded by patient</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Patient Reports</h3>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                            {records.length} report{records.length !== 1 ? 's' : ''} uploaded by {patientName}
                        </p>
                    </div>
                    {records.filter(r => !r.viewedByDoctor).length > 0 && (
                        <div className="flex">
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                                {records.filter(r => !r.viewedByDoctor).length} New
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    {records.map((record) => (
                        <div
                            key={record._id}
                            className={`p-3 rounded-lg border transition-all ${
                                record.viewedByDoctor
                                    ? 'bg-gray-50 border-gray-200'
                                    : 'bg-blue-50 border-blue-200'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-2xl flex-shrink-0">
                                    {getRecordIcon(record.recordType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 text-sm">
                                                {record.title}
                                            </h4>
                                            {record.description && (
                                                <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                                                    {record.description}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                                <span>{formatDate(record.date)}</span>
                                                <span>•</span>
                                                <span>{record.files.length} file{record.files.length !== 1 ? 's' : ''}</span>
                                                {record.viewedByDoctor && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-green-600">Viewed</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mt-4">
                                        <button
                                            onClick={() => openViewer(record)}
                                            className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
                                        >
                                            View
                                        </button>
                                        {record.files.length > 0 && (
                                            <button
                                                onClick={() => downloadFile(record.files[0].url, record.files[0].fileName)}
                                                className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-all border border-gray-200"
                                            >
                                                Download
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Record Viewer Modal */}
            {showViewer && selectedRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedRecord.title}</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {formatDate(selectedRecord.date)} • {selectedRecord.recordType.replace('_', ' ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowViewer(false);
                                        setSelectedRecord(null);
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {selectedRecord.description && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                    <p className="text-sm text-gray-700">{selectedRecord.description}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h3 className="font-semibold text-gray-900">Files ({selectedRecord.files.length})</h3>
                                {selectedRecord.files.map((file, idx) => (
                                    <div key={idx} className="border rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <div>
                                                    <p className="font-medium text-gray-900">{file.fileName}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {(file.fileSize / 1024 / 1024).toFixed(2)} MB • {file.fileType}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2 mt-3 sm:mt-0">
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white text-sm font-semibold rounded-lg transition-all text-center shadow-sm"
                                                >
                                                    Open
                                                </a>
                                                <button
                                                    onClick={() => downloadFile(file.url, file.fileName)}
                                                    className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-all border border-gray-200"
                                                >
                                                    Download
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PatientReportsViewer;

