import React from 'react';
import { Search, ChevronDown, Star, Clock, MapPin } from 'lucide-react';

const LabFilters = ({
  search,
  setSearch,
  testType,
  setTestType,
  rating,
  setRating,
  isOpenOnly,
  setIsOpenOnly,
  viewMode,
  setViewMode,
  isLoadingLocation
}) => {
  const testTypes = [
    'All Tests', 
    'Blood Test', 
    'Full Body Checkup', 
    'Diabetes Profile', 
    'Thyroid Test',
    'MRI', 
    'CT Scan', 
    'X-Ray', 
    'Ultrasound', 
    'ECG'
  ];
  const ratings = ['All Ratings', '4+', '3+', '2+'];

  return (
    <div className="bg-gray-50/80 rounded-xl p-2.5 sm:p-3 border border-gray-100 shadow-sm">
      {/* Filters Row - Enhanced Responsive Layout */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        
        {/* Search Bar - Flexible width */}
        <div className="relative group flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Search for labs or health tests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium text-gray-700"
          />
        </div>


        {/* Test Type Select */}
        <div className='flex items-center gap-2'>
          <label className='text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>Test Type:</label>
          <div className="relative">
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value)}
              className="h-10 appearance-none bg-white border border-gray-200 pl-3 pr-8 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer hover:border-gray-300 shadow-sm transition-all"
            >
              {testTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={14} />
          </div>
        </div>

        {/* Rating Select */}
        <div className='flex items-center gap-2'>
          <label className='text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap'>Rating:</label>
          <div className="relative">
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="h-10 appearance-none bg-white border border-gray-200 pl-3 pr-8 rounded-lg text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 cursor-pointer hover:border-gray-300 shadow-sm transition-all"
            >
              {ratings.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none gap-1">
              <Star size={10} fill="#f59e0b" className="text-amber-500" />
              <ChevronDown size={12} className="text-gray-400" />
            </div>
          </div>
        </div>

        {/* Open Now Toggle */}
        <button
          onClick={() => setIsOpenOnly(!isOpenOnly)}
          className={`h-10 flex items-center gap-2 px-4 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${isOpenOnly
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
            }`}
        >
          <Clock size={14} className={isOpenOnly ? 'text-emerald-500' : 'text-gray-400'} />
          Open Now
        </button>

        {/* Reset Button */}
        {(search || testType !== 'All Tests' || rating !== 'All Ratings' || isOpenOnly) && (
          <button
            onClick={() => {
              setSearch('');
              setTestType('All Tests');
              setRating('All Ratings');
              setIsOpenOnly(false);
            }}
            className="text-[10px] font-black text-blue-500 hover:text-blue-600 hover:underline uppercase tracking-widest ml-auto"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

export default LabFilters;
