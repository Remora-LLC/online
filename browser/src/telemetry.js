// telemetry.js
import { TelemetryClient, WebSocketTransport } from '@remora-llc/telemetry';

let telemetryPromise = null;
let telemetryClient = null;

export function initTelemetry({ fileId, baseUrl }) {
	if (telemetryPromise) {
		return telemetryPromise;
	}

	const transport = new WebSocketTransport(
		`${baseUrl}/global/api/v1/analysis/file/${fileId}`
	);

	telemetryPromise = (async () => {
		await transport.waitForHandshake();
		telemetryClient = new TelemetryClient(transport);
		return telemetryClient;
	})();

	return telemetryPromise;
}

export function getTelemetry() {
	if (!telemetryClient) {
		throw new Error('Telemetry not initialized. Call initTelemetry() first.');
	}
	return telemetryClient;
}

export function getTelemetryReady() {
	return telemetryPromise;
}
