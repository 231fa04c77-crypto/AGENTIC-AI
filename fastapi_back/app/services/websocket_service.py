from fastapi import WebSocket
from typing import Dict, List
import json

class ConnectionManager:
    def __init__(self):
        # Store active connections by appointmentId
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, appointment_id: str):
        await websocket.accept()
        if appointment_id not in self.active_connections:
            self.active_connections[appointment_id] = []
        self.active_connections[appointment_id].append(websocket)
        print(f"[SUCCESS] WebSocket connected for appointment: {appointment_id}")

    def disconnect(self, websocket: WebSocket, appointment_id: str):
        if appointment_id in self.active_connections:
            if websocket in self.active_connections[appointment_id]:
                self.active_connections[appointment_id].remove(websocket)
            if not self.active_connections[appointment_id]:
                del self.active_connections[appointment_id]
        print(f"🔌 WebSocket disconnected for appointment: {appointment_id}")

    async def notify_payment_success(self, appointment_id: str):
        if appointment_id in self.active_connections:
            message = json.dumps({
                "type": "PAYMENT_SUCCESS",
                "appointmentId": appointment_id,
                "timestamp": "" # Can add actual timestamp here
            })
            for connection in self.active_connections[appointment_id]:
                try:
                    await connection.send_text(message)
                except Exception as e:
                    print(f"[ERROR] Error sending WS message: {e}")

manager = ConnectionManager()
