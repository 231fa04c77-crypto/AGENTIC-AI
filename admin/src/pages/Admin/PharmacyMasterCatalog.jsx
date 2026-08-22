import React, { useState, useEffect } from 'react';
import {
  Search,
  Upload,
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Building2,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';

const INITIAL_REQUESTS = [
  {
    id: 'REQ-2001',
    name: 'Augmentin 625 Duo Tablet',
    salt: 'Amoxycillin (500mg) + Clavulanic Acid (125mg)',
    brand: 'GSK',
    category: 'Antibiotics',
    mrp: 220.0,
    price: 185.0,
    hsnCode: '30041000',
    requiresRx: true,
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
    status: 'pending',
    requestedBy: 'KIMS In-House Pharmacy',
  },
  {
    id: 'REQ-2002',
    name: 'Montair LC Tablet',
    salt: 'Montelukast (10mg) + Levocetirizine (5mg)',
    brand: 'Cipla',
    category: 'Allergy & Asthma',
    mrp: 195.0,
    price: 160.0,
    hsnCode: '30049099',
    requiresRx: true,
    image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=300',
    status: 'pending',
    requestedBy: 'Apollo Pharmacy - Brodipet',
  },
];

const PharmacyMasterCatalog = () => {
  const [catalog, setCatalog] = useState([]);
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [activeTab, setActiveTab] = useState('catalog');
  const [loading, setLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRxFilter, setSelectedRxFilter] = useState('All');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedRxFilter, itemsPerPage]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    salt: '',
    brand: '',
    category: 'Fever & Pain',
    mrp: 0,
    price: 0,
    hsnCode: '30049099',
    requiresRx: false,
    image: '',
  });

  const categories = ['All', 'Fever & Pain', 'Diabetes', 'Blood Pressure', 'Vitamins & Supplements', 'Stomach Care', 'Antibiotics', 'Allergy & Asthma'];

  const getBackendUrl = () => {
    // Optional Express pharmacy catalog. Patient search uses FastAPI.
    // Leave unset to disable inventory sync (no localhost:5001 hardcode).
    return (import.meta.env.VITE_PHARMACY_SERVICE_URL || '').replace(/\/$/, '');
  };

  const fetchCatalogFromDB = async () => {
    setLoading(true);
    try {
      const base = getBackendUrl();
      if (!base) {
        return;
      }
      const res = await fetch(`${base}/api/inventory`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped = data.map((item) => ({
            id: item._id || `MED-${Math.floor(1000 + Math.random() * 9000)}`,
            _id: item._id,
            name: item.name || 'Unnamed Medicine',
            salt: item.salt || item.composition || 'Generic Composition',
            brand: item.brand || item.distributor || 'Pharma',
            category: item.category || 'General',
            mrp: item.mrp || item.price || 50,
            price: item.price || item.costPrice || 40,
            hsnCode: item.hsnCode || '30049099',
            requiresRx: item.requiresRx || false,
            image: item.image || '',
            stock: item.stock || 0,
            status: 'active',
          }));
          setCatalog(mapped);
        }
      }
    } catch (err) {
      console.warn('Could not fetch from backend API, keeping current state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogFromDB();
  }, []);

  const filteredCatalog = catalog.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.salt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesRx =
      selectedRxFilter === 'All' ||
      (selectedRxFilter === 'Rx Required' && item.requiresRx) ||
      (selectedRxFilter === 'OTC (No Rx)' && !item.requiresRx);
    return matchesSearch && matchesCat && matchesRx;
  });

  const totalPages = Math.ceil(filteredCatalog.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCatalog = filteredCatalog.slice(startIndex, startIndex + itemsPerPage);

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.brand) return;

    const payload = {
      name: formData.name,
      salt: formData.salt || 'Generic Salt Composition',
      brand: formData.brand || 'Pharma Brand',
      category: formData.category || 'General',
      mrp: Number(formData.mrp) || 0,
      price: Number(formData.price) || 0,
      costPrice: Number(formData.price) ? Number(formData.price) * 0.75 : 10,
      hsnCode: formData.hsnCode || '30049099',
      requiresRx: !!formData.requiresRx,
      image: formData.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
      stock: 100,
      distributor: formData.brand || 'General Wholesaler',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    try {
      if (editingMedicine && editingMedicine._id) {
        await fetch(`${getBackendUrl()}/api/inventory/update/${editingMedicine._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${getBackendUrl()}/api/inventory/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
    } catch (err) {
      console.warn('Backend save error:', err);
    }

    await fetchCatalogFromDB();
    setIsAddModalOpen(false);
    setEditingMedicine(null);
    setFormData({
      name: '',
      salt: '',
      brand: '',
      category: 'Fever & Pain',
      mrp: 0,
      price: 0,
      hsnCode: '30049099',
      requiresRx: false,
      image: '',
    });
  };

  const handleEditClick = (med) => {
    setEditingMedicine(med);
    setFormData(med);
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id, _id) => {
    if (_id) {
      try {
        await fetch(`${getBackendUrl()}/api/inventory/${_id}`, { method: 'DELETE' });
      } catch (err) {
        console.warn('Backend delete error:', err);
      }
    }
    setCatalog(catalog.filter((m) => m.id !== id && m._id !== _id));
  };

  const handleApproveRequest = async (req) => {
    setRequests(requests.filter((r) => r.id !== req.id));
    const payload = {
      name: req.name,
      salt: req.salt,
      brand: req.brand,
      category: req.category,
      mrp: req.mrp,
      price: req.price,
      hsnCode: req.hsnCode,
      requiresRx: req.requiresRx,
      image: req.image,
      stock: 100,
    };
    try {
      await fetch(`${getBackendUrl()}/api/inventory/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn(err);
    }
    fetchCatalogFromDB();
  };

  const handleRejectRequest = (id) => {
    setRequests(requests.filter((r) => r.id !== id));
  };

  const handleBulkFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select an Excel (.xlsx, .xls) or CSV (.csv) file first!');
      return;
    }

    setUploadProgress(10);
    setUploadStatus('Uploading & Parsing file via Express Backend API...');

    try {
      const data = new FormData();
      data.append('file', selectedFile);

      const res = await fetch(`${getBackendUrl()}/api/inventory/bulk-upload`, {
        method: 'POST',
        body: data,
      });

      setUploadProgress(70);
      setUploadStatus('Saving medicines to MongoDB Database...');

      if (res.ok) {
        const result = await res.json();
        setUploadProgress(100);
        setUploadStatus(result.message || 'Excel Bulk Import Complete!');
        await fetchCatalogFromDB();

        setTimeout(() => {
          setIsUploadModalOpen(false);
          setSelectedFile(null);
          setUploadProgress(null);
          setUploadStatus(null);
        }, 1200);
      } else {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Upload failed');
      }
    } catch (error) {
      setUploadStatus('Parsing CSV text client-side...');
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = event.target?.result;
          const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
          if (lines.length <= 1) {
            alert('File appears to be empty or missing data rows.');
            setUploadProgress(null);
            setUploadStatus(null);
            return;
          }

          const parsedMeds = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 2 && cols[0]) {
              const name = cols[0];
              const salt = cols[1] || 'Generic Composition';
              const brand = cols[2] || 'Pharma';
              const category = cols[3] || 'General';
              const mrp = parseFloat(cols[4]) || 50;
              const price = parseFloat(cols[5]) || mrp * 0.8;
              const hsnCode = cols[6] || '30049099';
              const requiresRx = cols[7]?.toLowerCase() === 'true' || cols[7]?.toLowerCase() === 'yes';
              const image = cols[8] || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300';

              parsedMeds.push({
                id: `MED-${Math.floor(1000 + Math.random() * 9000)}`,
                name,
                salt,
                brand,
                category,
                mrp,
                price,
                hsnCode,
                requiresRx,
                image,
                status: 'active',
              });

              fetch(`${getBackendUrl()}/api/inventory/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, salt, brand, category, mrp, price, costPrice: price * 0.75, hsnCode, requiresRx, image, stock: 100 }),
              }).catch(() => {});
            }
          }

          setCatalog((prev) => [...parsedMeds, ...prev]);
          setUploadProgress(100);
          setUploadStatus(`Imported ${parsedMeds.length} medicines into Master Catalog!`);
          setTimeout(() => {
            setIsUploadModalOpen(false);
            setSelectedFile(null);
            setUploadProgress(null);
            setUploadStatus(null);
          }, 1200);
        } catch (err) {
          alert('Could not parse file: ' + err.message);
          setUploadProgress(null);
          setUploadStatus(null);
        }
      };
      reader.readAsText(selectedFile);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              Super Admin Portal
            </span>
            <span className="flex items-center text-teal-200 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Live Verified Drug Database
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">
            Pharmacy Master Catalog
          </h1>
          <p className="text-teal-100 text-sm mt-1">
            Centralized repository for verified medicines, prices, HSN codes, and pharmacy request approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchCatalogFromDB}
            className="flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
            title="Refresh from MongoDB Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh DB
          </button>
          <button
            onClick={() => {
              setSelectedFile(null);
              setUploadProgress(null);
              setUploadStatus(null);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Bulk CSV/Excel Upload
          </button>
          <button
            onClick={() => {
              setEditingMedicine(null);
              setFormData({
                name: '',
                salt: '',
                brand: '',
                category: 'Fever & Pain',
                mrp: 0,
                price: 0,
                hsnCode: '30049099',
                requiresRx: false,
                image: '',
              });
              setIsAddModalOpen(true);
            }}
            className="flex items-center px-4 py-2.5 bg-white text-teal-800 hover:bg-teal-50 text-sm font-semibold rounded-xl transition-all shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Drug
          </button>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center space-x-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
            activeTab === 'catalog'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Master Catalog ({catalog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all relative ${
            activeTab === 'requests'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>New Drug Requests Queue</span>
          {requests.length > 0 && (
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search medicine brand, generic salt composition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'All' ? 'All Categories' : c}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={selectedRxFilter}
                onChange={(e) => setSelectedRxFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg text-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="All">All Types (Rx & OTC)</option>
                <option value="Rx Required">Rx Required Only</option>
                <option value="OTC (No Rx)">OTC Only</option>
              </select>
            </div>
          </div>

          {/* Catalog Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Medicine & Brand</th>
                    <th className="py-3.5 px-4">Generic Salt</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">MRP / Price</th>
                    <th className="py-3.5 px-4">HSN Code</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                        Loading medicines from database...
                      </td>
                    </tr>
                  ) : filteredCatalog.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No medicines in the master catalog yet. Click "Bulk CSV/Excel Upload" or "Add New Drug" to add medicines.
                      </td>
                    </tr>
                  ) : (
                    paginatedCatalog.map((med) => (
                      <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={med.image}
                              alt={med.name}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                              onError={(e) => {
                                e.target.src =
                                  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300';
                              }}
                            />
                            <div>
                              <div className="font-bold text-slate-900">{med.name}</div>
                              <div className="text-xs text-slate-500">
                                {med.brand} · ID: {med.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">
                          {med.salt}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-md text-xs font-medium">
                            {med.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-emerald-600">₹{med.price}</div>
                          <div className="text-xs text-slate-400 line-through">MRP: ₹{med.mrp}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {med.hsnCode}
                        </td>
                        <td className="py-3.5 px-4">
                          {med.requiresRx ? (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-xs font-bold flex items-center w-max">
                              <AlertCircle className="w-3 h-3 mr-1" /> Rx Required
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium w-max inline-block">
                              OTC Medicine
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleEditClick(med)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors"
                              title="Edit Details"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(med.id, med._id)}
                              className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                              title="Delete Drug"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {filteredCatalog.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                <div className="flex items-center space-x-2">
                  <span>
                    Showing <strong className="text-slate-900">{startIndex + 1}</strong> to{' '}
                    <strong className="text-slate-900">
                      {Math.min(startIndex + itemsPerPage, filteredCatalog.length)}
                    </strong>{' '}
                    of <strong className="text-teal-700">{filteredCatalog.length}</strong> medicines
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500">Items per page:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Previous
                    </button>

                    <span className="px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg font-bold border border-teal-200">
                      Page {currentPage} of {totalPages || 1}
                    </span>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage >= totalPages || totalPages === 0}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* New Drug Requests Queue Tab */
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 text-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <strong>Local Pharmacy Requests:</strong> Local tied-up pharmacies submit custom medicine requests when items are missing from the Master Catalog.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.length === 0 ? (
              <div className="col-span-2 py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
                No pending medicine requests at this time.
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-md">
                        Requested by: {req.requestedBy}
                      </span>
                      <span className="text-xs text-slate-400">{req.id}</span>
                    </div>

                    <div className="mt-3 flex items-start space-x-3">
                      <img
                        src={req.image}
                        alt={req.name}
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{req.name}</h3>
                        <p className="text-xs text-slate-500">{req.salt} · By {req.brand}</p>
                        <div className="mt-2 flex items-center space-x-4 text-xs">
                          <span className="text-slate-600 font-semibold">MRP: ₹{req.mrp}</span>
                          <span className="text-emerald-600 font-semibold">Price: ₹{req.price}</span>
                          <span className="text-slate-500">HSN: {req.hsnCode}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center"
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject Request
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req)}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve & Add to Master
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Medicine Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingMedicine ? 'Edit Drug Details' : 'Add New Drug to Master Catalog'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medicine Brand Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dolo 650mg Tablet"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Generic Salt Composition *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paracetamol (650mg)"
                  value={formData.salt || ''}
                  onChange={(e) => setFormData({ ...formData, salt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Manufacturer / Brand *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Micro Labs"
                    value={formData.brand || ''}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category || 'Fever & Pain'}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  >
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="40.00"
                    value={formData.mrp || ''}
                    onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="32.50"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    placeholder="30049099"
                    value={formData.hsnCode || '30049099'}
                    onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Medicine Image (URL or Upload from Device)
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste Image URL (https://...)"
                      value={formData.image || ''}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <label className="cursor-pointer bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 font-semibold px-3 py-2 rounded-lg text-xs border border-slate-300 transition-all flex items-center shrink-0">
                      <Upload className="w-3.5 h-3.5 mr-1 text-teal-600" />
                      Browse File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setFormData((prev) => ({ ...prev, image: event.target.result }));
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>

                  {formData.image && (
                    <div className="flex items-center space-x-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <img
                        src={formData.image}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-md border border-slate-200"
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300';
                        }}
                      />
                      <div className="text-[11px] text-slate-600 flex-1 truncate">
                        <span className="font-semibold text-emerald-700">Image Loaded Ready</span>
                        <div className="truncate text-slate-400">{formData.image.slice(0, 45)}...</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image: '' })}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="requiresRxJSX"
                  checked={!!formData.requiresRx}
                  onChange={(e) => setFormData({ ...formData, requiresRx: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <label htmlFor="requiresRxJSX" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Prescription Required (`requiresRx: true`)
                </label>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-xs shadow-md"
                >
                  {editingMedicine ? 'Update Drug' : 'Save to Catalog & DB'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk CSV / Excel Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bulk Upload Master Drug Catalog
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload CSV or Excel file containing medicine records (Brand, Salt, MRP, HSN, Image).
              </p>
            </div>

            <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-6 transition-all bg-slate-50 relative">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSelectedFile(f);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              {selectedFile ? (
                <div className="text-xs font-bold text-teal-700">
                  📄 {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-700">
                    Click or drag `.csv` or `.xlsx` file here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Supports Excel & CSV formats</p>
                </>
              )}
            </div>

            {uploadProgress !== null && (
              <div className="space-y-2 text-left bg-slate-50 p-3 rounded-lg border">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Processing & Saving...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">{uploadStatus}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkFileUpload}
                disabled={uploadProgress !== null}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center"
              >
                <Upload className="w-4 h-4 mr-1.5" /> Start Import & Sync DB
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PharmacyMasterCatalog;
