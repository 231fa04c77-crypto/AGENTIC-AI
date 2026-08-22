import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Phone, Droplets, Activity, Clock, ShieldCheck, ChevronRight, Search } from 'lucide-react';
import BackArrow from '../components/BackArrow';
import BackButton from '../components/BackButton';

const bloodBanks = [
  { id: 1, name: "Central Blood Bank", location: "Secunderabad, Hyderabad", phone: "+91 40 1234 5678", availability: { "A+": "Available", "B+": "Limited", "O+": "Unavailable", "AB+": "Available" }, isGovt: true, hours: "24/7" },
  { id: 2, name: "Red Cross Society", location: "Himayatnagar, Hyderabad", phone: "+91 40 2345 6789", availability: { "A-": "Limited", "O-": "Unavailable", "B-": "Available", "AB-": "Available" }, isGovt: false, hours: "8 AM – 8 PM" },
  { id: 3, name: "LifeShare Blood Center", location: "Kukatpally, Hyderabad", phone: "+91 40 3456 7890", availability: { "O+": "Available", "A+": "Available", "B+": "Available", "O-": "Limited" }, isGovt: false, hours: "9 AM – 9 PM" },
  { id: 4, name: "Apollo Blood Bank", location: "Jubilee Hills, Hyderabad", phone: "+91 40 4567 8901", availability: { "A+": "Available", "B+": "Available", "AB+": "Limited", "O+": "Available" }, isGovt: false, hours: "24/7" },
  { id: 5, name: "NIMS Blood Bank", location: "Punjagutta, Hyderabad", phone: "+91 40 5678 9012", availability: { "O-": "Available", "O+": "Available", "A-": "Available", "B-": "Unavailable" }, isGovt: true, hours: "24/7" },
  { id: 6, name: "Rotary Blood Bank", location: "Dilsukhnagar, Hyderabad", phone: "+91 40 6789 0123", availability: { "A+": "Available", "AB-": "Limited", "B+": "Available", "O-": "Available" }, isGovt: false, hours: "7 AM – 7 PM" }
];

const bloodTypes = ['All', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const BloodDropIcon = ({ type, status }) => {
  const isLimited = status === 'Limited';
  
  return (
    <div className="relative group/drop">
      <svg width="40" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path 
          d="M12 22C16.4183 22 20 18.4183 20 14C20 8 12 2 12 2C12 2 4 8 4 14C4 18.4183 7.58172 22 12 22Z" 
          fill={isLimited ? "#fee2e2" : "#fef2f2"}
          stroke={isLimited ? "#f87171" : "#fee2e2"}
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="grad-red" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center pt-4 text-[9px] font-black text-red-600`}>
        {type}
      </span>
    </div>
  );
};

export default function BloodPlus() {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = bloodBanks.filter(bank => {
    const matchesFilter = filter === 'All' || Object.keys(bank.availability).includes(filter);
    const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         bank.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#fafafa] pt-24 pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white border-b border-gray-100">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-red-50/30 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="mb-6 flex items-center gap-4">
            <BackArrow />
            <BackButton to="/" label="Back to Home" />
          </div>
          
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-red-100">
                <Activity size={12} />
                Live Emergency Network
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-none mb-6 tracking-tight">
                Blood<span className="text-red-600">+</span> Emergency Hub
              </h1>
              <p className="text-gray-500 text-base max-w-lg leading-relaxed mb-8">
                Every drop counts. Locate nearby blood banks, monitor stock levels in real-time, and save lives during critical emergencies.
              </p>
              
              <div className="flex flex-wrap gap-4">
                {[
                  { label: "Active Centers", val: "12+", color: "bg-red-50 text-red-600" },
                  { label: "Donors Online", val: "2.4k", color: "bg-blue-50 text-blue-600" },
                  { label: "Lives Saved", val: "15k+", color: "bg-emerald-50 text-emerald-600" }
                ].map((stat, i) => (
                  <div key={i} className={`${stat.color} px-6 py-3 rounded-2xl border border-white shadow-sm`}>
                    <div className="text-xl font-black">{stat.val}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{stat.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden lg:block relative"
            >
              <div className="bg-gradient-to-br from-red-600 to-red-800 rounded-[2.5rem] p-8 shadow-2xl shadow-red-200 aspect-video flex flex-col justify-end text-white overflow-hidden group">
                <Droplets size={120} className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700" />
                <div className="relative z-10">
                  <h2 className="text-3xl font-black mb-2 leading-tight">Need Urgent Blood?</h2>
                  <p className="opacity-80 text-sm mb-6 max-w-xs">Our 24/7 coordination team is ready to assist you in finding matching donors immediately.</p>
                  <button className="bg-white text-red-700 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-red-50 transition-colors shadow-lg">
                    Raise Emergency Request
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-6 mb-10 items-end">
          <div className="flex-1 space-y-4">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Filter by Group</h2>
            <div className="flex flex-wrap gap-2">
              {bloodTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    filter === type 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-200 outline-none scale-105' 
                    : 'bg-white text-gray-400 border border-gray-100 hover:border-red-200'
                  }`}
                >
                  {type} {type !== 'All' && 'Type'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="w-full md:w-80">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-red-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search center or area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl text-sm focus:ring-4 focus:ring-red-500/5 focus:border-red-200 outline-none shadow-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filtered.map(bank => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={bank.id}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-xl transition-all duration-500 group relative"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mb-4 group-hover:bg-red-600 group-hover:text-white transition-all duration-500">
                    <Droplets size={24} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {bank.isGovt && (
                      <span className="bg-gray-900 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                        Official
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                      <Clock size={10} />
                      {bank.hours}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-black text-gray-900 mb-2 truncate group-hover:text-red-600 transition-colors pt-2">
                  {bank.name}
                </h3>
                
                <div className="flex items-center gap-1.5 text-gray-400 text-xs font-medium mb-6">
                  <MapPin size={12} className="text-red-400" />
                  {bank.location}
                </div>

                {/* Stock - Grid of Drops */}
                <div className="bg-[#fafafa] rounded-2xl p-4 mb-8 border border-gray-50">
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Blood Stock</span>
                    <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-1">
                      <ShieldCheck size={10} /> Live Verified
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(bank.availability).map(([type, status]) => (
                      <div key={type} className="flex flex-col items-center">
                        <BloodDropIcon type={type} status={status} />
                        <span className={`text-[8px] font-black mt-1 uppercase text-gray-400`}>
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <a 
                    href={`tel:${bank.phone}`}
                    className="flex-1 h-12 bg-gray-50 hover:bg-gray-100 text-gray-900 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest"
                  >
                    <Phone size={14} />
                    Call
                  </a>
                  <button className="flex-[2] h-12 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs uppercase tracking-widest shadow-lg shadow-red-100 active:scale-95">
                    Request Unit
                    <ChevronRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900">No centers found</h3>
            <p className="text-gray-500">Try adjusting your filters or searching for a different area.</p>
          </div>
        )}
      </div>
    </div>
  );
}
