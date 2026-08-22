import React, { useState, useEffect, useMemo, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Droplets, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import LabCard from '../components/LabCard';
import LabFilters from '../components/LabFilters';
import BookTestModal from '../components/BookTestModal';
import BloodBankCard from '../components/BloodBankCard';
import { AppContext } from '../context/AppContext';
import BackButton from '../components/BackButton';
import BackArrow from '../components/BackArrow';

import axios from 'axios';
import { toast } from 'react-toastify';

const BloodDropLoader = () => (
  <div className="flex justify-center items-center py-20 gap-2">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.3, 1, 0.3],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          delay: i * 0.2,
        }}
        className="w-4 h-6 bg-[#dc2626] rounded-t-full rounded-b-[50%] shadow-lg shadow-red-500/20"
      />
    ))}
  </div>
);

const Labs = () => {
  const { backendUrl } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('labs');
  const [search, setSearch] = useState('');
  const [testType, setTestType] = useState('All Tests');
  const [rating, setRating] = useState('All Ratings');
  const [isOpenOnly, setIsOpenOnly] = useState(false);
  const [isLabsLoading, setIsLabsLoading] = useState(true);
  const [isBloodLoading, setIsBloodLoading] = useState(true);
  const [selectedLab, setSelectedLab] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [labs, setLabs] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);

  // BUG FIX: Keep a stable copy of the original full labs list.

  // Fetch Labs
  const fetchLabs = async () => {
    setIsLabsLoading(true);
    try {
      const { data } = await axios.get(`${backendUrl}/api/lab/list`);
      if (data.success) {
        setLabs(data.labs);
        originalLabsRef.current = data.labs; // BUG FIX: Store original list
      }
    } catch (error) {
      console.error("Error fetching labs:", error);
    } finally {
      setIsLabsLoading(false);
    }
  };

  // Fetch Blood Banks
  const fetchBloodBanks = async () => {
    setIsBloodLoading(true);
    try {
      const { data } = await axios.get(`${backendUrl}/api/blood-bank/list`);
      if (data.success) {
        setBloodBanks(data.bloodBanks);
      }
    } catch (error) {
      console.error("Error fetching blood banks:", error);
    } finally {
      setIsBloodLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
    fetchBloodBanks();
  }, [backendUrl]);

  // Combine and format labs to display
  const labsToDisplay = useMemo(() => {
    return labs.map(lab => {
      // Robust array conversion for tests/services
      let tests = [];
      const services = lab.services || lab.tests_available || [];
      if (Array.isArray(services)) {
        tests = services;
      } else if (typeof services === 'string') {
        try { tests = JSON.parse(services); } catch (e) { tests = []; }
      }

      return {
        ...lab,
        tests: tests,
        status: lab.openNow || lab.available ? "Open Now" : "Closed"
      };
    });
  }, [labs]);

  // Filtering logic
  const filteredLabs = useMemo(() => {
    return labsToDisplay.filter(lab => {
      // Basic Filters
      const matchesSearch = lab.name.toLowerCase().includes(search.toLowerCase()) ||
        lab.tests.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchesTest = testType === 'All Tests' || lab.tests.includes(testType);
      const matchesRating = rating === 'All Ratings' || lab.rating >= parseInt(rating);
      const matchesOpen = !isOpenOnly || lab.status === 'Open Now';

      return matchesSearch && matchesTest && matchesRating && matchesOpen;
    });
  }, [labsToDisplay, search, testType, rating, isOpenOnly]);

  const handleBook = (lab) => {
    setSelectedLab(lab);
    setIsModalOpen(true);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, testType, rating, isOpenOnly, activeTab]);

  // Pagination logic
  const indexOfLastLab = currentPage * itemsPerPage;
  const indexOfFirstLab = indexOfLastLab - itemsPerPage;
  const currentLabs = filteredLabs.slice(indexOfFirstLab, indexOfLastLab);
  const totalPages = Math.ceil(filteredLabs.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-white pb-20 pt-24 sm:pt-28 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Breadcrumb Navigation */}
        <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4'>
          <BackArrow className="flex-shrink-0" />
          <BackButton className="flex-grow sm:flex-grow-0" />
        </div>

        {/* Header Section */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight mb-2"
          >
            All <span className="text-cyan-500">Labs & Blood Banks</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-gray-600 text-sm md:text-base max-w-2xl mx-auto font-medium"
          >
            Browse our network of trusted, collaborated labs and blood centers near you.
          </motion.p>

          <div className="flex bg-white/20 backdrop-blur-md p-1 rounded-full w-fit mx-auto shadow-sm mt-6 mb-8 border border-white/40">
            <button
              onClick={() => setActiveTab('labs')}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 ${activeTab === 'labs'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-gray-500 hover:bg-white/30'
                }`}
            >
              <Beaker size={14} />
              Collaborated Labs
            </button>
            <button
              onClick={() => setActiveTab('blood')}
              className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all duration-300 ${activeTab === 'blood'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-200/50'
                }`}
            >
              <Droplets size={14} />
              Collaborated Blood Banks
            </button>
          </div>
        </div>

        {/* Filters and List */}
        <AnimatePresence mode="wait">
          {activeTab === 'labs' ? (
            <motion.div
              key="labs-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <LabFilters
                search={search}
                setSearch={setSearch}
                testType={testType}
                setTestType={setTestType}
                rating={rating}
                setRating={setRating}
                isOpenOnly={isOpenOnly}
                setIsOpenOnly={setIsOpenOnly}
              />

              <div className="mt-8">
                {isLabsLoading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredLabs.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {currentLabs.map((lab) => (
                        <LabCard key={lab.id} lab={lab} onBook={handleBook} />
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="flex justify-center items-center mt-10 gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="p-2 rounded-full border border-gray-200 text-gray-500 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-10 h-10 rounded-full font-medium transition-colors ${currentPage === i + 1
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="p-2 rounded-full border border-gray-200 text-gray-500 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-20 bg-white/30 backdrop-blur-md rounded-2xl border border-dashed border-gray-200">
                    <Search className="text-gray-400 mx-auto mb-3" size={40} />
                    <h3 className="text-lg font-bold text-gray-700">No matching labs found</h3>
                    <p className="text-xs text-gray-400 mt-1 font-medium">Try adjusting your filters or search terms</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="blood-view"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              {isBloodLoading ? (
                <BloodDropLoader />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
                  {bloodBanks.map((bank) => (
                    <BloodBankCard key={bank.id} bank={{
                      ...bank,
                      partner: bank.partner_type === 'partner',
                      availability: bank.available_blood
                    }} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BookTestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lab={selectedLab}
      />
    </div>
  );
};

export default Labs;
