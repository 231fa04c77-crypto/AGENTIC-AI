import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, MapPin } from 'lucide-react';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const BloodDrop = ({ className, fill, strokeColor }) => (
  <svg 
    viewBox="0 0 24 24" 
    className={className} 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path 
      d="M12 22C16.4183 22 20 18.4183 20 14C20 8 12 2 12 2C12 2 4 8 4 14C4 18.4183 7.58172 22 12 22Z" 
      fill={fill}
      stroke={strokeColor}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

// 4 distinct status styles
const getStatusStyle = (availability, bankId) => {
  const val = (availability || 'Unavailable').trim().toLowerCase();

  if (val === 'available' || val === 'in stock') {
    return {
      dropColor: '#ef4444', // Solid Red
      strokeColor: '#dc2626',
      textColor: 'text-white',
      shadow: 'drop-shadow-[0_4px_8px_rgba(220,38,38,0.25)]',
    };
  }

  if (val === 'limited') {
    return {
      dropColor: '#f59e0b', // Solid Amber
      strokeColor: '#d97706',
      textColor: 'text-amber-900',
      shadow: 'drop-shadow-[0_4px_8px_rgba(245,158,11,0.25)]',
    };
  }
  // Unavailable / Out of Stock / default
  return {
    dropColor: '#f1f5f9',
    strokeColor: '#e2e8f0',
    textColor: 'text-slate-400',
    shadow: '',
  };
};

const BloodBankCard = ({ bank }) => {
  const bankId = bank._id || bank.id || Math.random().toString(36).substr(2, 9);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 p-6 transition-all duration-500 group relative overflow-hidden"
    >
      {/* Subtle Background Glow */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-50 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      {/* SVG Gradient Defs — shared once per card */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={`grad-red-${bankId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff4d4d" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id={`grad-cyan-${bankId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
          <linearGradient id={`grad-amber-${bankId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Section */}
      <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
        <div>
          <h3 className="text-lg font-black text-[#1e293b] group-hover:text-red-600 transition-colors leading-tight mb-2 tracking-tight">
            {bank.name}
          </h3>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider">
              <div className="p-1 bg-slate-50 rounded-md">
                <MapPin size={10} className="text-slate-500" />
              </div>
              {bank.city || 'Regional Distribution Center'}
            </div>
            {bank.distance && bank.distance < 100 && (
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-red-600 text-[10px] font-black tracking-widest uppercase">
                  {bank.distance.toFixed(1)} km away
                </span>
              </div>
            )}
          </div>
        </div>
        {bank.partner && (
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full border border-indigo-100/50 shadow-sm">
            <ShieldCheck size={12} className="text-indigo-500" />
            Partner
          </div>
        )}
      </div>

      {/* Blood Type Grid */}
      <div className="relative mb-2 bg-[#f8fafc]/50 backdrop-blur-sm p-5 rounded-[1.5rem] border border-slate-100 shadow-inner">
        <div className="grid grid-cols-4 gap-x-3 gap-y-5">
          {bloodTypes.map((type) => {
            // Robust availability extraction
            let availabilityData = bank.availability;
            
            // If it's a string (common with some DB drivers), try to parse it
            if (typeof availabilityData === 'string') {
              try {
                availabilityData = JSON.parse(availabilityData);
              } catch (e) {
                availabilityData = {};
              }
            }

            const status = (availabilityData && availabilityData[type]) || bank[type] || 'Unavailable';
            const { dropColor, strokeColor, textColor, shadow } = getStatusStyle(status, bankId);

            return (
              <motion.div
                key={type}
                whileHover={{ scale: 1.1, y: -2 }}
                className="flex flex-col items-center justify-center relative"
                title={`${type}: ${status}`}
              >
                <div className="relative group/drop">
                  <BloodDrop 
                    className={`w-12 h-12 transition-all duration-300 ${shadow}`}
                    fill={dropColor}
                    strokeColor={strokeColor}
                  />
                  <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black pointer-events-none pt-4 ${textColor}`}>
                    {type}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        
        {/* Legend — 4 statuses */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-2 pt-4 border-t border-slate-200/50">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Limited</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Unavailable</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BloodBankCard;

