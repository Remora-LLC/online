import { TelemetryClient, WebSocketTransport } from '@remora-llc/telemetry';

// expose globals for Collabora
window.TelemetryLib = {
  TelemetryClient,
  WebSocketTransport
};