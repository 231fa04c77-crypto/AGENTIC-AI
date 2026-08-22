import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Loader2, Calendar, User, Phone, Mail, FileText } from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import { useContext } from 'react';

const BookTestModal = ({ lab, isOpen, onClose }) => {
  const navigate = useNavigate();
  const { backendUrl, token, userData } = useContext(AppContext);
  const [formData, setFormData] = useState({
    fullName: '',
    testName: '',
    dob: '',
    phone: '',
    email: '',
    preferredDate: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data } = await axios.post(`${backendUrl}/api/lab/book`, {
        ...formData,
        labName: lab.name,
        userId: userData?._id
      }, { headers: { token } });

      if (data.success) {
        setIsSuccess(true);
        toast.success("Test request submitted successfully!");
        
        // Navigation to Digital Pass
        setTimeout(() => {
          onClose();
          navigate('/appointment-confirmation', {
            state: {
              appointmentData: {
                patientName: formData.fullName,
                providerName: lab.name,
                providerType: 'lab',
                service: formData.testName,
                date: new Date(formData.preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                time: "As scheduled",
                location: lab.location || "Diagnostic Center",
                id: `LAB-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
              }
            }
          });
          // Reset states for future bookings
          setIsSuccess(false);
          setFormData({
            fullName: '',
            testName: '',
            dob: '',
            phone: '',
            email: '',
            preferredDate: '',
            notes: ''
          });
        }, 1500);
      } else {
        toast.error(data.message || "Failed to submit booking");
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-start pt-24 pb-8 px-4 overflow-y-auto">
          {/* Backdrop click-to-close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 z-0"
          />
          
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative z-10 bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {isSuccess ? (
              <div className="p-10 text-center flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-5"
                >
                  <CheckCircle2 size={32} className="text-emerald-600" />
                </motion.div>
                <h2 className="text-xl font-bold text-[#0b1b35] mb-2">Request Confirmed!</h2>
                <p className="text-sm text-gray-500 font-medium max-w-sm mx-auto">
                  We have successfully received your test request for <span className="text-blue-600 font-bold">{lab?.name}</span>.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <div>
                    <h2 className="text-lg font-bold text-[#0b1b35]">Schedule Test</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-0.5">{lab?.name}</p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form Body - 2 Column Layout */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                          required
                          name="fullName"
                          value={formData.fullName}
                          onChange={handleChange}
                          type="text"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700"
                          placeholder="John Doe"
                        />
                      </div>
                    </div>

                    {/* Test Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Test Name</label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <select
                          required
                          name="testName"
                          value={formData.testName}
                          onChange={handleChange}
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700 bg-white appearance-none"
                        >
                          <option value="">Select a test</option>
                          {lab?.tests.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date of Birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                          required
                          name="dob"
                          value={formData.dob}
                          onChange={handleChange}
                          type="date"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700"
                        />
                      </div>
                    </div>

                    {/* Preferred Date */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preferred Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                          required
                          name="preferredDate"
                          value={formData.preferredDate}
                          onChange={handleChange}
                          type="date"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700"
                        />
                      </div>
                    </div>

                    {/* Phone Number */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                          required
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          type="tel"
                          placeholder="+91 00000 00000"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700"
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                        <input
                          required
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          type="email"
                          placeholder="example@mail.com"
                          className="w-full h-10 pl-9 pr-4 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700"
                        />
                      </div>
                    </div>

                    {/* Notes - Full Width */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Notes (Optional)</label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        rows="2"
                        className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-sm text-gray-700 resize-none"
                        placeholder="State any requirements..."
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="mt-8">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        "FINALIZE BOOKING"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BookTestModal;
