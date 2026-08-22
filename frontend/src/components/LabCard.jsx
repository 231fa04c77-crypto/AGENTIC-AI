import React from 'react';
import { motion } from 'framer-motion';
import { Star, MapPin, Beaker, Clock, ShieldCheck, CheckCircle, ChevronRight, Building2 } from 'lucide-react';

const LabCard = ({ lab, onBook }) => {
  const isHospital = lab.type?.toLowerCase().includes('hospital');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col group"
    >
      <div className="flex flex-col h-full">
        {/* Top Section */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shrink-0">
              {isHospital ? <Building2 size={20} /> : <Beaker size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0b1b35] leading-tight tracking-tight group-hover:text-blue-600 transition-colors">
                {lab.name}
              </h3>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-1 text-gray-400">
                  <MapPin size={10} />
                  <span className="text-[10px] font-bold truncate max-w-[120px]">{lab.location.split(',')[0]}</span>
                </div>
                {lab.distance && lab.distance < 100 && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <span className="text-[10px] font-black">{lab.distance.toFixed(1)} km away</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <div className="flex gap-0.5 mb-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < Math.floor(lab.rating) ? "#f59e0b" : "transparent"}
                  className={i < Math.floor(lab.rating) ? "text-amber-500" : "text-gray-200"}
                />
              ))}
            </div>
            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">
              {lab.rating} Rating
            </span>
          </div>
        </div>

        {/* Status Line */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-md">
            <Clock size={10} className="text-gray-400" />
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{lab.status}</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-md">
            <ShieldCheck size={10} className="text-emerald-500" />
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Verified</span>
          </div>
        </div>

        {/* Services / Tags */}
        <div className="flex-1 mb-5">
          <div className="flex flex-wrap gap-1.5">
            {lab.tests.slice(0, 4).map((test, i) => (
              <span
                key={i}
                className="text-[9px] font-bold text-gray-500 bg-gray-50/50 border border-slate-100 px-2.5 py-1 rounded-md"
              >
                {test}
              </span>
            ))}
            {lab.tests.length > 4 && (
              <span className="text-[9px] font-bold text-blue-500 px-1 pt-1">+{lab.tests.length - 4}</span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto pt-2">
          {lab.isExternal ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (lab.contact && lab.contact !== 'Not available') {
                    window.open(`tel:${lab.contact}`, '_self');
                  } else {
                    const searchQuery = encodeURIComponent(`${lab.name} ${lab.location} phone number`);
                    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
                  }
                }}
                className={`w-full h-10 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-xs font-bold shadow-sm ${
                  !lab.contact || lab.contact === 'Not available'
                  ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                  : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                {(!lab.contact || lab.contact === 'Not available') ? 'Search Phone' : 'Call Now'}
              </button>
          ) : (
            <button
              onClick={() => onBook(lab)}
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm shadow-sm"
            >
              Book Appointment
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default LabCard;
