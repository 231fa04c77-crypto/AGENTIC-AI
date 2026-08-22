/**
 * SHAMS Node.js + Express Webhook Receiver Route
 *
 * File path in SHAMS Server:
 *   routes/medclues.js   (or register directly in server.js)
 *
 * Usage:
 *   const medcluesRoute = require('./routes/medclues');
 *   app.use(medcluesRoute);
 */

const express = require('express');
const router = express.Router();

router.post('/api/medclues/webhook', express.json(), (req, res) => {
  const event = req.headers['x-medclues-event'] || 'unknown';
  const signature = req.headers['x-medclues-signature'] || '';
  const timestamp = req.headers['x-medclues-timestamp'] || '';
  const payload = req.body;

  console.log('====================================================');
  console.log(`🚨 [MEDCLUES WEBHOOK RECEIVED] Event: ${event}`);
  console.log(`⏱  Timestamp: ${timestamp}`);
  console.log(`🔑 Case ID: ${payload?.case_id}`);
  console.log(`🚦 Status: ${payload?.status}`);
  if (payload?.hospital_name) {
    console.log(`🏥 Assigned Hospital: ${payload.hospital_name}`);
  }
  if (payload?.ambulance_eta_minutes) {
    console.log(`⏱  Ambulance ETA: ${payload.ambulance_eta_minutes} mins`);
  }
  console.log('====================================================');

  // React to status updates (e.g. broadcast to clients using your own Socket.io, or save to MongoDB)
  // For now, we print to the console and return 200 so MEDCLUES stops retrying.
  res.status(200).json({ success: true, received: true });
});

module.exports = router;
