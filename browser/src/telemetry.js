// telemetry.js
(function (global) {
	const { TelemetryClient, WebSocketTransport } = global.TelemetryLib; // adjust if needed

	let telemetryPromise = null;
	let telemetryClient = null;

	global.initTelemetry = function ({ fileId, baseUrl }) {
		if (telemetryPromise) return telemetryPromise;

		const transport = new WebSocketTransport(
			`${baseUrl}/global/api/v1/analysis/file/${fileId}`
		);

		telemetryPromise = (async () => {
			await transport.waitForHandshake();
			telemetryClient = new TelemetryClient(transport);
			return telemetryClient;
		})();

		return telemetryPromise;
	};

	global.getTelemetry = function () {
		if (!telemetryClient) {
			throw new Error('Telemetry not initialized. Call initTelemetry() first.');
		}
		return telemetryClient;
	};

	global.getTelemetryReady = function () {
		return telemetryPromise;
	};
})(window);
