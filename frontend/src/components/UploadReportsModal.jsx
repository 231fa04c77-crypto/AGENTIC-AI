import React, { useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { AppContext } from '../context/AppContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const UploadReportsModal = ({ docId, docName, appointmentId, onClose, onSuccess }) => {
    const { backendUrl, token, userData } = useContext(AppContext);
    const [formData, setFormData] = useState({
        recordType: 'lab_report',
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        // Limit to 10 files
        const remainingSlots = 10 - files.length;
        const filesToAdd = selectedFiles.slice(0, remainingSlots);
        setFiles([...files, ...filesToAdd]);
    };

    const removeFile = (index) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (files.length === 0) {
            toast.error('Please select at least one file');
            return;
        }

        if (!formData.title.trim()) {
            toast.error('Please enter a title for the report');
            return;
        }

        setIsUploading(true);

        try {
            const formDataToSend = new FormData();

            // Ensure backend receives the authenticated user ID for validation
            if (userData?._id) {
                formDataToSend.append('userId', userData._id);
            }
            formDataToSend.append('recordType', formData.recordType);
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description || '');
            formDataToSend.append('docId', docId);
            formDataToSend.append('doctorName', docName);
            formDataToSend.append('date', formData.date);
            if (appointmentId) {
                formDataToSend.append('appointmentId', appointmentId);
            }

            files.forEach(file => {
                formDataToSend.append('files', file);
            });

            const { data } = await axios.post(
                `${backendUrl}/api/user/health-records`,
                formDataToSend,
                {
                    headers: { token },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        // You can show progress here if needed
                    }
                }
            );

            if (data.success) {
                toast.success('Reports uploaded successfully! Doctor will be able to view them during consultation.');
                if (onSuccess) onSuccess();
                onClose();
            } else {
                toast.error(data.message || 'Failed to upload reports');
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to upload reports');
        } finally {
            setIsUploading(false);
        }
    };

    return createPortal(
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 sm:p-10 lg:p-12 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl border border-white/20 flex flex-col animate-in zoom-in-95 duration-300">
                {/* Safe spacing from top on mobile */}
                <div className="h-4 w-full bg-transparent flex-shrink-0 lg:hidden"></div>
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-cyan-100 flex items-center justify-center text-cyan-600 shadow-sm flex-shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Upload Medical Reports</h2>
                            <p className="text-xs text-slate-500 mt-1 font-medium leading-tight">These will be shared with Dr. {docName || 'your doctor'}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        disabled={isUploading}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Record Type Grid */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Document Classification</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { id: 'lab_report', label: 'Lab Report', icon: '🧪' },
                                    { id: 'xray', label: 'Imaging (X-Ray/MRI)', icon: '📷' },
                                    { id: 'medical_note', label: 'Doctor Note', icon: '📝' },
                                    { id: 'other', label: 'Other', icon: '📄' }
                                ].map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, recordType: type.id })}
                                        className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                                            formData.recordType === type.id 
                                            ? 'border-cyan-500 bg-cyan-50/50 text-cyan-700 shadow-sm' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className="text-xl">{type.icon}</span>
                                        <span className="text-sm font-bold">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Details Section */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Report Title*</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-sm font-medium"
                                    placeholder="e.g., Full Body Checkup, Sugar Test"
                                    required
                                    disabled={isUploading}
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Report Date*</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-sm font-medium cursor-pointer"
                                        required
                                        disabled={isUploading}
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                     <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="text-[10px] text-amber-700 font-bold uppercase leading-tight">Shared Securely</p>
                                     </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Additional description (Optional)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-sm font-medium resize-none"
                                    rows="3"
                                    placeholder="Attach notes for the doctor..."
                                    disabled={isUploading}
                                />
                            </div>
                        </div>

                        {/* File Upload Area */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Files ({files.length}/10)</label>
                            <input
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                disabled={isUploading || files.length >= 10}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`group relative flex flex-col items-center justify-center p-8 rounded-[2rem] border-2 border-dashed transition-all duration-300 ${
                                    isUploading || files.length >= 10 
                                    ? 'bg-slate-50 border-slate-200 cursor-not-allowed opacity-60' 
                                    : 'bg-slate-50/50 border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/30 cursor-pointer'
                                }`}
                            >
                                <div className="w-16 h-16 rounded-3xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-cyan-500 group-hover:scale-110 transition-all duration-300 mb-4">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-900">Tap to upload medical files</p>
                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">PDF, Images, DOCX (Max 10MB each)</p>
                                </div>
                            </label>
                            
                            {/* Improved File List */}
                            {files.length > 0 && (
                                <div className="mt-4 grid grid-cols-1 gap-2">
                                    {files.map((file, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm group animate-in slide-in-from-bottom-2 duration-300">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const url = URL.createObjectURL(file);
                                                        window.open(url, '_blank');
                                                    }}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition-all duration-200"
                                                    title="Preview File"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFile(idx)}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                                                    disabled={isUploading}
                                                    title="Remove"
                                                >
                                                    <svg className="w-5 h-5 " fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                        disabled={isUploading}
                    >
                        Back
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className={`flex-[2] py-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-200 transition-all active:scale-95 flex items-center justify-center gap-2 ${
                            isUploading || files.length === 0
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-cyan-600 text-white hover:bg-cyan-700'
                        }`}
                        disabled={isUploading || files.length === 0}
                    >
                        {isUploading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Upload to Cloud
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UploadReportsModal;

