import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";

export const ReceptionContext = createContext();

const ReceptionContextProvider = ({ children }) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const [recToken, setRecToken] = useState(
    sessionStorage.getItem("recToken") || ""
  );
  const [recInfo, setRecInfo] = useState(
    sessionStorage.getItem("recInfo")
      ? JSON.parse(sessionStorage.getItem("recInfo"))
      : null
  );

  useEffect(() => {
    const onRefresh = (e) => {
      if (e.detail?.role === "receptionist" && e.detail.token)
        setRecToken(e.detail.token);
    };
    const onLogout = (e) => {
      if (e.detail?.role === "receptionist") {
        setRecToken("");
        setRecInfo(null);
      }
    };
    window.addEventListener("auth:tokenRefreshed", onRefresh);
    window.addEventListener("auth:logout", onLogout);
    return () => {
      window.removeEventListener("auth:tokenRefreshed", onRefresh);
      window.removeEventListener("auth:logout", onLogout);
    };
  }, []);

  const authHeader = { rectoken: recToken };

  const handle = async (promise, { silent } = {}) => {
    try {
      const { data } = await promise;
      if (data?.success === false && !silent) toast.error(data.message || "Request failed");
      return data;
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || err.message);
      return { success: false, message: err.message };
    }
  };

  // ── Reads ──────────────────────────────────────────────────────────────
  const getDashboard = () =>
    handle(axios.get(`${backendUrl}/api/reception/dashboard`, { headers: authHeader }));

  const getDoctors = () =>
    handle(axios.get(`${backendUrl}/api/reception/doctors`, { headers: authHeader }));

  const getOnlineBookings = (date) =>
    handle(
      axios.get(`${backendUrl}/api/reception/online-bookings`, {
        headers: authHeader,
        params: date ? { date } : {},
      })
    );

  const getQueue = (doctorId, date) =>
    handle(
      axios.get(`${backendUrl}/api/reception/queue`, {
        headers: authHeader,
        params: { ...(doctorId ? { doctorId } : {}), ...(date ? { date } : {}) },
      })
    );

  const getFollowups = () =>
    handle(axios.get(`${backendUrl}/api/reception/followups`, { headers: authHeader }));

  const getPayments = (date) =>
    handle(
      axios.get(`${backendUrl}/api/reception/payments`, {
        headers: authHeader,
        params: date ? { date } : {},
      })
    );

  const getRefundRequests = () =>
    handle(axios.get(`${backendUrl}/api/reception/refund-requests`, { headers: authHeader }));

  const getNoShows = () =>
    handle(axios.get(`${backendUrl}/api/reception/no-shows`, { headers: authHeader }));

  const getGraceRequests = () =>
    handle(axios.get(`${backendUrl}/api/reception/grace-requests`, { headers: authHeader }));

  const approveGraceRequest = (id, notes) =>
    handle(
      axios.post(
        `${backendUrl}/api/reception/grace-requests/${id}/approve`,
        { notes },
        { headers: authHeader }
      )
    );

  const rejectGraceRequest = (id, notes) =>
    handle(
      axios.post(
        `${backendUrl}/api/reception/grace-requests/${id}/reject`,
        { notes },
        { headers: authHeader }
      )
    );

  const getPatients = (date) =>
    handle(
      axios.get(`${backendUrl}/api/reception/patients`, {
        headers: authHeader,
        params: date ? { date } : undefined,
      })
    );

  const searchPatients = (q) =>
    handle(
      axios.get(`${backendUrl}/api/reception/patients/search`, {
        headers: authHeader,
        params: { q },
      }),
      { silent: true }
    );

  const getConsultationSummary = (id) =>
    handle(
      axios.get(`${backendUrl}/api/reception/consultation-summary/${id}`, {
        headers: authHeader,
      })
    );

  // ── Writes ─────────────────────────────────────────────────────────────
  const verifyAppointment = (id, notes) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/verify`, { notes }, { headers: authHeader })
    );

  const generateToken = (id) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/generate-token`, {}, { headers: authHeader })
    );

  const markArrived = (id) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/arrive`, {}, { headers: authHeader })
    );

  const markNoShow = (id) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/no-show`, {}, { headers: authHeader })
    );

  const collectPayment = (id, method = "cash") =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/collect-payment`, { method }, { headers: authHeader })
    );

  const requestRefund = (id, reason) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/refund-request`, { reason }, { headers: authHeader })
    );

  const useFollowup = (id) =>
    handle(
      axios.post(`${backendUrl}/api/reception/appointments/${id}/use-followup`, {}, { headers: authHeader })
    );

  const registerPatient = (payload) =>
    handle(axios.post(`${backendUrl}/api/reception/patients`, payload, { headers: authHeader }));

  const bookWalkIn = (payload) =>
    handle(axios.post(`${backendUrl}/api/reception/walk-in`, payload, { headers: authHeader }));

  const checkIn = (bookingId) => {
    const id =
      bookingId && typeof bookingId === 'object'
        ? bookingId.bookingId || bookingId.booking_id
        : bookingId
    return handle(
      axios.post(`${backendUrl}/api/reception/check-in`, { bookingId: id }, { headers: authHeader })
    )
  }

  const queueAction = (id, action) =>
    handle(
      axios.post(`${backendUrl}/api/reception/queue/${id}/action`, { action }, { headers: authHeader })
    );

  const logout = () => {
    setRecToken("");
    setRecInfo(null);
    sessionStorage.removeItem("recToken");
    sessionStorage.removeItem("recInfo");
  };

  const value = {
    recToken,
    setRecToken,
    recInfo,
    setRecInfo,
    backendUrl,
    getDashboard,
    getDoctors,
    getOnlineBookings,
    getQueue,
    getFollowups,
    getPayments,
    getRefundRequests,
    getNoShows,
    getGraceRequests,
    approveGraceRequest,
    rejectGraceRequest,
    getPatients,
    searchPatients,
    getConsultationSummary,
    verifyAppointment,
    generateToken,
    markArrived,
    markNoShow,
    collectPayment,
    requestRefund,
    useFollowup,
    registerPatient,
    bookWalkIn,
    checkIn,
    queueAction,
    logout,
  };

  return (
    <ReceptionContext.Provider value={value}>{children}</ReceptionContext.Provider>
  );
};

export default ReceptionContextProvider;
