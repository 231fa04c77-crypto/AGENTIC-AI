import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  QrCode,
  Search,
  CheckCircle,
  Package,
  Building2,
  BellRing,
  Clock,
  UserCheck,
  ShoppingBag,
  Check,
  Zap,
  ToggleLeft,
  ToggleRight,
  RefreshCw
} from 'lucide-react';
import { AdminContext } from '../../context/AdminContext';
import { useQrPharmacyScanner } from '../../hooks/useQrPharmacyScanner';
import { extractPharmacyOrderId } from '../../utils/pharmacyOrderId';

const HospitalPharmacyCounter = () => {
  const { aToken, backendUrl } = useContext(AdminContext);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedToken, setScannedToken] = useState('');
  const [matchedOrder, setMatchedOrder] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);

  const [invSearch, setInvSearch] = useState('');

  const getBackendUrl = () =>
    (backendUrl || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

  const authHeaders = () => (aToken ? { aToken } : {});

  const mapOrder = (o) => ({
    id: String(o.id),
    token: o.publicId || o.token || `PHO-${o.id}`,
    patientName: o.patientName || 'Patient',
    patientPhone: o.patientPhone || '',
    type: String(o.fulfillment || '').includes('delivery') ? 'express_delivery' : 'counter_pickup',
    status:
      o.status === 'delivered' || o.status === 'cancelled'
        ? 'completed'
        : o.status === 'ready' || o.status === 'billed' || o.status === 'paid'
          ? 'packed'
          : 'pending',
    items: (o.items || []).map((it, index) => ({
      id: String(it.id || index + 1),
      name: it.name || 'Medicine',
      qty: it.qty || it.quantity || 1,
      price: it.price || 0,
      requiresRx: false,
    })),
    total: o.total ?? o.amountTotal ?? 0,
    time: o.createdAt ? new Date(o.createdAt).toLocaleString() : '—',
  });

  const fetchOrdersFromDB = async () => {
    const base = getBackendUrl();
    if (!base || !aToken) return;
    try {
      const res = await fetch(`${base}/api/admin/pharmacy/counter/orders?limit=50`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.success && Array.isArray(data.orders)) {
        setOrders(data.orders.map(mapOrder));
      }
    } catch (err) {
      console.warn('Orders fetch error:', err);
    }
  };

  const fetchInventoryFromDB = async () => {
    setLoading(true);
    // Inventory mapping remains optional Express pharmacy — not required for PHO pickup.
    setInventory([]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrdersFromDB();
    fetchInventoryFromDB();
  }, [aToken, backendUrl]);

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'pending') return o.status === 'pending';
    if (filterStatus === 'packed') return o.status === 'packed';
    if (filterStatus === 'express') return o.type === 'express_delivery';
    return true;
  });

  const handleUpdateOrderStatus = async (orderId, nextStatus) => {
    setOrders(
      orders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    const base = getBackendUrl();
    if (!base || !aToken) return;
    try {
      await fetch(`${base}/api/admin/pharmacy/counter/orders/${orderId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (err) {
      console.warn('Status update failed:', err);
    }
  };

  const handleScanToken = useCallback(async (tokenInput) => {
    const token = extractPharmacyOrderId(tokenInput) || String(tokenInput || '').trim().toUpperCase();
    if (!token) {
      setMatchedOrder(null);
      setScanMessage('Scan or enter a pickup token (PHO…)');
      return;
    }
    setScannedToken(token);
    const local = orders.find(
      (o) =>
        o.token.toLowerCase() === token.toLowerCase() ||
        o.id.toLowerCase() === token.toLowerCase()
    );
    if (local) {
      setMatchedOrder(local);
      setScanMessage(null);
      return;
    }
    const base = getBackendUrl();
    if (!base || !aToken) {
      setMatchedOrder(null);
      setScanMessage(`No active order found for token "${token}"`);
      return;
    }
    try {
      const res = await fetch(
        `${base}/api/admin/pharmacy/counter/lookup?token=${encodeURIComponent(token)}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (data?.success && data.order) {
        const mapped = mapOrder(data.order);
        setMatchedOrder(mapped);
        setScanMessage(null);
        setOrders((prev) => {
          if (prev.some((o) => o.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else {
        setMatchedOrder(null);
        setScanMessage(data?.message || `No active order found for token "${token}"`);
      }
    } catch {
      setMatchedOrder(null);
      setScanMessage(`Lookup failed for "${token}"`);
    }
  }, [orders, aToken, backendUrl]);

  const onPharmacyScan = useCallback(
    (code, raw) => {
      void handleScanToken(code || raw);
    },
    [handleScanToken]
  );

  const { videoRef, camOn, toggleCam } = useQrPharmacyScanner({
    enabled: isScannerOpen,
    onCode: onPharmacyScan,
  });

  const handleToggleStock = async (item) => {
    const nextInStock = !item.inStock;
    const nextQty = nextInStock ? 100 : 0;
    setInventory(
      inventory.map((inv) =>
        inv.id === item.id ? { ...inv, inStock: nextInStock, stockQty: nextQty } : inv
      )
    );
  };

  const handleUpdatePriceQty = async (item, field, value) => {
    setInventory(
      inventory.map((inv) =>
        inv.id === item.id
          ? { ...inv, [field]: value, inStock: field === 'stockQty' ? value > 0 : inv.inStock }
          : inv
      )
    );
  };


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-teal-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-400/30 flex items-center">
              <Building2 className="w-3.5 h-3.5 mr-1" /> Hospital In-House Counter
            </span>
            <span className="bg-white/10 text-white text-xs font-medium px-2.5 py-0.5 rounded-full">
              KIMS Ground Floor Counter
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mt-2 flex items-center">
            Hospital Pharmacy Counter & Fulfillment
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Real-time e-prescription queue, 10-minute counter pickup scanner, and local store inventory mapper.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchOrdersFromDB}
            className="flex items-center px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition-all"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setScannedToken('');
              setMatchedOrder(null);
              setScanMessage(null);
              setIsScannerOpen(true);
              void fetchOrdersFromDB();
            }}
            className="flex items-center px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR Code / Token
          </button>
        </div>
      </div>

      {/* Live Order Chime Alert */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg animate-bounce">
            <BellRing className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-indigo-950 text-sm">Live Prescription Queue Active</h4>
            <p className="text-xs text-indigo-700">
              Doctors' digital e-prescriptions land here automatically. Pack medicines for 10-min counter pickup.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-bold text-indigo-900 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Avg Pickup Ready Time: 6 mins</span>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'queue'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Live Order Queue ({orders.filter((o) => o.status === 'pending').length} Pending)</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'inventory'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Store Inventory & Price Mapper ({inventory.length})</span>
          </button>
        </div>

        {activeTab === 'queue' && (
          <div className="flex items-center space-x-2 pb-2">
            <span className="text-xs font-medium text-slate-500">Filter:</span>
            {['all', 'pending', 'packed', 'express'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                  filterStatus === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === 'queue' ? (
        /* Live Orders Queue Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredOrders.length === 0 ? (
            <div className="col-span-2 py-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              No orders in this queue.
            </div>
          ) : (
            filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-base">{ord.token}</span>
                      <span className="text-xs text-slate-400">({ord.id})</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {ord.type === 'counter_pickup' ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-md flex items-center">
                          <Zap className="w-3 h-3 mr-1" /> 10-Min Counter Pickup
                        </span>
                      ) : (
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold px-2.5 py-1 rounded-md flex items-center">
                          <Package className="w-3 h-3 mr-1" /> Express Home Delivery
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Patient Info */}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{ord.patientName}</p>
                      <p className="text-slate-500">{ord.patientPhone}</p>
                    </div>
                    <span className="text-slate-400">{ord.time}</span>
                  </div>

                  {ord.doctorNotes && (
                    <div className="mt-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900 font-medium">
                      <strong>Doctor Rx Note:</strong> {ord.doctorNotes}
                    </div>
                  )}

                  {/* Prescribed Items Table */}
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Prescribed Medicines:
                    </p>
                    {ord.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          {it.qty}x {it.name}
                          {it.requiresRx && (
                            <span className="ml-1 text-[10px] text-amber-600 font-bold bg-amber-100 px-1 rounded">
                              Rx Required
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-slate-600">₹{it.price * it.qty}</span>
                      </div>
                    ))}
                    <div className="border-t pt-1.5 flex justify-between font-bold text-xs text-slate-900">
                      <span>Total Payable Amount</span>
                      <span className="text-emerald-600">₹{ord.total}</span>
                    </div>
                  </div>
                </div>

                {/* Status Action Buttons */}
                <div className="pt-2 border-t flex items-center justify-between">
                  <div className="text-xs">
                    Status:{' '}
                    <span
                      className={`font-bold capitalize ${
                        ord.status === 'pending'
                          ? 'text-amber-600'
                          : ord.status === 'packed'
                          ? 'text-blue-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {ord.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'packed')}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center"
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Mark Packed & Ready
                      </button>
                    )}

                    {ord.status === 'packed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'completed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center"
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1" /> Hand Over to Patient
                      </button>
                    )}

                    {ord.status === 'completed' && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center">
                        <Check className="w-4 h-4 mr-1" /> Completed & Collected
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Store Inventory Mapper Tab */
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search store inventory by medicine name or generic salt..."
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Medicine & Brand</th>
                  <th className="py-3.5 px-4">MRP (₹)</th>
                  <th className="py-3.5 px-4">Local Store Price (₹)</th>
                  <th className="py-3.5 px-4">Stock Quantity</th>
                  <th className="py-3.5 px-4">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      Loading inventory from database...
                    </td>
                  </tr>
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No medicines in inventory yet. Add or import medicines from the Master Catalog.
                    </td>
                  </tr>
                ) : (
                  inventory
                    .filter(
                      (item) =>
                        item.name.toLowerCase().includes(invSearch.toLowerCase()) ||
                        item.salt.toLowerCase().includes(invSearch.toLowerCase())
                    )
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500">{item.salt} · By {item.brand}</div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-500">₹{item.mrp}</td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            step="0.5"
                            value={item.localPrice}
                            onChange={(e) =>
                              handleUpdatePriceQty(item, 'localPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 px-2 py-1 border rounded font-semibold text-emerald-600 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <input
                            type="number"
                            value={item.stockQty}
                            onChange={(e) =>
                              handleUpdatePriceQty(item, 'stockQty', parseInt(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 border rounded font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleStock(item)}
                            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                              item.inStock
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.inStock ? (
                              <>
                                <ToggleRight className="w-4 h-4 text-emerald-600" />
                                <span>IN STOCK</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-4 h-4 text-red-500" />
                                <span>OUT OF STOCK</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QR Scanner / Prescription Token Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Hospital Counter Pickup Scanner
                </h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-900 text-white p-6 rounded-2xl text-center space-y-3 relative overflow-hidden">
              <div className="w-full max-w-xs aspect-square border-2 border-dashed border-emerald-400 rounded-xl mx-auto flex items-center justify-center relative overflow-hidden bg-black">
                {camOn ? (
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                ) : (
                  <QrCode className="w-20 h-20 text-emerald-400 opacity-80" />
                )}
              </div>
              <button
                type="button"
                onClick={() => void toggleCam()}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg"
              >
                {camOn ? 'Stop camera' : 'Start camera'}
              </button>
              <p className="text-xs text-slate-300">
                Scan patient pickup QR (PHO…) or enter token below
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Enter pickup token / order ID manually:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="e.g. PHO00000001"
                  value={scannedToken}
                  onChange={(e) => setScannedToken(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg uppercase tracking-wider font-bold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  onClick={() => handleScanToken(scannedToken)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Verify
                </button>
              </div>
            </div>

            {scanMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold">
                {scanMessage}
              </div>
            )}

            {matchedOrder && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-emerald-950">
                  <span>Token Verified: {matchedOrder.token}</span>
                  <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                    Patient: {matchedOrder.patientName}
                  </span>
                </div>

                <div className="text-xs space-y-1">
                  <p className="font-semibold text-slate-700">Prescribed Items:</p>
                  {matchedOrder.items.map((it) => (
                    <p key={it.id} className="text-slate-600">
                      • {it.qty}x {it.name}
                    </p>
                  ))}
                </div>

                <button
                  onClick={() => {
                    handleUpdateOrderStatus(matchedOrder.id, 'completed');
                    setIsScannerOpen(false);
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center shadow-md"
                >
                  <Check className="w-4 h-4 mr-1" /> Hand Over Medicines to Patient
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalPharmacyCounter;
