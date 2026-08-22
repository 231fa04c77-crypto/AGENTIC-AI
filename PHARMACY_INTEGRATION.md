# 💊 MedClues & MedClues Pharmacy Integration Guide

## 📌 Executive Summary
This document outlines the architectural plan, navigation structure, security keys, API specifications, and data flow for connecting **`medclues-main`** (Flutter App & FastAPI Backend) with **`Medclues-Pharmacy-main`** (Node.js Express Backend & React Pharmacy Web App).

---

## 🎨 1. UI/UX Navigation Structure (4-Section Hub)

The Pharmacy module inside MedClues features a **4-Section Navigation System**:

```
+-----------------------------------------------------------------------------------+
|  ← Pharmacy Hub                              [ Search medicines, diseases... 🔍 ] |
+-----------------------------------------------------------------------------------+
|  [💊 All Medicines]     [📄 Prescriptions]     [📦 Orders]     [🏥 Nearby Stores] |
+-----------------------------------------------------------------------------------+
```

### 1️⃣ 💊 All Medicines (E-Commerce Store)
* **Search Bar & Filters:** Search by medicine name, salt composition, or brand.
* **Filter by Specialities:** Cardiology, Orthopedics, Pediatrics, Dermatology, Neurology.
* **Filter by Diseases & Conditions:** Diabetes, Blood Pressure, Fever & Cold, Stomach Care.
* **Product Cards:** Medicine Image, Price, Discount Tag, Prescription Required Badge, and *"Add to Cart"* button.

### 2️⃣ 📄 Prescriptions (Strict In-House Hospital Routing)
* **Compulsory In-House Hospital Pharmacy Routing:** When a doctor writes a prescription at a hospital (e.g. *KIMS Hospital*), the digital prescription is **compulsorily routed directly to that hospital's In-House Pharmacy** (e.g. *KIMS Ground Floor Pharmacy*).
* **Automatic Queue Landing:** The prescription automatically appears live in that specific hospital pharmacy's web dashboard (`PrescriptionQueue.tsx`).
* **Counter Pickup with QR:** Patient receives a notification with a digital QR Code & Prescription ID (`RX-9842`). The patient simply shows the QR code at the hospital's pharmacy counter to collect their packed medicines.
* **Upload Custom Rx:** Option for patients to upload external paper prescription photos using their mobile camera for general medicine orders.


### 3️⃣ 📦 Orders & Live Tracking
* **Live Order Progress:** Real-time tracking (`Order Received ➔ Packed ➔ Out for Delivery ➔ Delivered`).
* **Invoices & Refills:** Download PDF invoices and 1-click monthly medicine refills.

### 4️⃣ 🏥 Nearby Pharmacies
* **Location Finder:** Map and List view of nearby MedClues partner pharmacy stores based on patient GPS.
* **Store Details:** Distance (e.g., *1.2 km away*), Open/Closed status, store phone number, and directions.

---

## 🔑 2. Security & Environment Keys

Both `.env` files share synchronized key configurations:

| Key Name | Purpose | Value / Setting |
| :--- | :--- | :--- |
| **`INTERNAL_API_KEY`** | **Partner Integration Key:** Secures backend-to-backend calls (`X-Internal-Api-Key`). | `d82a9cf038d0f27d90d0601ae5aa3eefd8562b1a7303ba3b2151dc2b13a3b461` |
| **`JWT_SECRET`** | **Single Sign-On (SSO):** Validates patient login tokens across both servers. | `guT_BWh2siVvezfj1wMMTHOjqWQnP6ZNRBOyfBxsjME` |
| **`SERVICE_URLs`** | **Network Routing:** Directs API traffic between local ports (`5000` & `5001`) and live servers. | • `PHARMACY_SERVICE_URL=http://localhost:5001`<br>• `MEDCLUES_CORE_URL=http://localhost:5000` |
| **`CLOUDINARY & RAZORPAY`** | **Media & Payment Gateways:** Handles prescription images & online payments. | Shared Cloudinary & Razorpay keys. |

---

## 🔄 3. Data Flow Architecture

```
[ MongoDB Database ]  ──▶  [ Express Backend ]  ──▶  [ FastAPI Core ]  ──▶  [ Flutter App Screen ]
 (Stores inventory &        (Port 5001)              (Port 5000)            (Displays medicines,
  medicine products)                                                        prescriptions & orders)
```

---

## 📡 4. Webhooks & API Endpoints

### A. Doctor Prescription Sync (FastAPI ➔ Express)
* **Trigger:** Doctor completes a consultation and generates a prescription.
* **Endpoint:** `POST http://localhost:5001/api/integration/medclues/prescription`
* **Header:** `X-Internal-Api-Key: d82a9cf038d0f27d90d0601ae5aa3eefd8562b1a7303ba3b2151dc2b13a3b461`

### B. Live Order Status Push (Express ➔ FastAPI ➔ Mobile App)
* **Trigger:** Pharmacist updates order status on the web dashboard.
* **Endpoint:** `POST http://localhost:5000/api/partner/webhook/pharmacy-status`
* **Result:** Triggers a live mobile push notification to the patient.

### C. Medicine Catalog Search (Flutter ➔ FastAPI ➔ Express)
* **Trigger:** Patient searches for a medicine or category in the app.
* **Endpoint:** `GET http://localhost:5000/api/user/pharmacy/search?q=paracetamol`

---

## 🚀 5. Step-by-Step Implementation Roadmap

1. **Phase 1: Backend Connection Check**  
   Verify HTTP requests between `fastapi_back` (Port 5000) and `Medclues-Pharmacy-main` (Port 5001) using `X-Internal-Api-Key`.

2. **Phase 2: Mobile UI Build (`medclues-main`)**  
   Implement the 4-Section navigation layout in `pharmacy_screen.dart`, add `medicine_details_screen.dart`, and `pharmacy_cart_screen.dart`.

3. **Phase 3: Web Dashboard Alert (`Medclues-Pharmacy-main`)**  
   Add a live audio chime & toast notification in `PrescriptionQueue.tsx` when a new patient prescription arrives.

4. **Phase 4: End-to-End Testing**  
   Test the complete workflow: Doctor prescribes medicine ➔ App displays Rx ➔ Patient orders ➔ Pharmacy accepts ➔ App updates live tracking.
