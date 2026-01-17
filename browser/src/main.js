/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain a copy at http://mozilla.org/MPL/2.0/.
 */

/* global globalThis UIManager */
/* global errorMessages accessToken accessTokenTTL noAuthHeader accessHeader createOnlineModule */
/* global app $ host idleTimeoutSecs outOfFocusTimeoutSecs _ LocaleService LayoutingService */
/* global ServerConnectionService createEmscriptenModule */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/

(function (global) {

console.log('[INIT] bundle start');

// ----------------------------
// WOPI and file parameters
// ----------------------------
var wopiParams = {};
var wopiSrc = global.coolParams.get('WOPISrc');
var fileId = null;

if (wopiSrc) {
	try {
		var url = new URL(wopiSrc);
		var parts = url.pathname.split('/').filter(Boolean);
		if (parts.length >= 3 && parts[0] === 'wopi' && parts[1] === 'files') {
			fileId = parts[2];
		}
	} catch (e) {
		console.error('[WOPI] Failed to parse WOPISrc:', e);
	}
}

console.log('[WOPI] Parsed fileId:', fileId);
console.log('[PARAM] WOPISrc raw:', wopiSrc);
console.log('[PARAM] accessToken:', accessToken);
console.log('[PARAM] accessTokenTTL:', accessTokenTTL);
console.log('[PARAM] noAuthHeader:', noAuthHeader);
console.log('[PARAM] accessHeader:', accessHeader);

if (wopiSrc !== '' && accessToken !== '') {
	console.log('[WOPI] Using access_token authentication');
	wopiParams = {
		'access_token': accessToken,
		'access_token_ttl': accessTokenTTL
	};
	if (noAuthHeader == "1" || noAuthHeader == "true") {
		console.log('[WOPI] no_auth_header enabled');
		wopiParams.no_auth_header = noAuthHeader;
	}
} else if (wopiSrc !== '' && accessHeader !== '') {
	console.log('[WOPI] Using access_header authentication');
	wopiParams = { 'access_header': accessHeader };
} else {
	console.log('[WOPI] No WOPI authentication parameters applied');
}

console.log('[WOPI] Final wopiParams:', wopiParams);

var filePath = global.coolParams.get('file_path');
console.log('[PARAM] file_path:', filePath);

app.localeService = new LocaleService();
app.setPermission(global.coolParams.get('permission') || 'edit');
console.log('[PARAM] permission:', global.coolParams.get('permission') || 'edit');

app.serverConnectionService = new ServerConnectionService();
app.layoutingService = new LayoutingService();

var timestamp = global.coolParams.get('timestamp');
var target = global.coolParams.get('target') || '';
var alwaysActive = global.coolParams.get('alwaysactive');
var debugMode = global.coolParams.get('debug');

console.log('[PARAM] timestamp:', timestamp);
console.log('[PARAM] target:', target);
console.log('[PARAM] alwaysactive:', alwaysActive);
console.log('[PARAM] debug:', debugMode);

var docURL, docParams;
var isWopi = false;

if (wopiSrc) {
	docURL = decodeURIComponent(wopiSrc);
	docParams = wopiParams;
	isWopi = true;
	console.log('[DOC] Mode: WOPI');
	console.log('[DOC] Decoded WOPISrc:', docURL);
} else {
	docURL = filePath;
	docParams = {};
	console.log('[DOC] Mode: local file');
	console.log('[DOC] filePath:', docURL);
}

console.log('[DOC] docParams:', docParams);
console.log('[DOC] isWopi:', isWopi);

var notWopiButIframe = !!global.coolParams.get('NotWOPIButIframe');
console.log('[PARAM] NotWOPIButIframe:', notWopiButIframe);

// ----------------------------
// JSON Telemetry Types
// ----------------------------
app.HazardFlag = {
	Unknown: 0, Paste: 1, Typing: 2, Edit: 3, Window: 4, Nudge: 5, Hardware: 6, Network: 7
};

app.EditActionType = {
	NotSet: 0, Replace: 1, Delete: 2, Undo: 3, Redo: 4, Copy: 5, Cut: 6,
	SelectAll: 7, CopyAll: 8, Bold: 9, Italic: 10, Underline: 11, Strikethrough: 12,
	Highlight: 13, TextColor: 14, FontSize: 15, FontFamily: 16, MetaEnter: 17,
	MetaLeftArrow: 18, MetaRightArrow: 19, MetaUpArrow: 20, MetaDownArrow: 21,
	MetaBackslash: 22, MetaReload: 23
};

app.PasteActionType = { NotSet: 0, Internal: 1 };
app.PasteCitationStatus = { NotSet: 0, Uncited: 1, FalseCitation: 2, TrueCitation: 3 };
app.PasteFormatStatus = { NotSet: 0, Inconsistent: 1 };

app.TypingActionType = { NotSet: 0, Typing: 1, Submit: 2 };

app.WindowState = { NotSet: 0, Focus: 1, Blur: 2, Close: 3, Full: 4 };

app.NudgeContentType = { NotSet: 0, PromptInjection: 1, Malicious: 2, Sensitive: 3 };

// ----------------------------
// WebSocket Transport
// ----------------------------
class WebSocketTransport {
	constructor(url) {
		this.url = url;
		this.ws = null;
		this.queue = [];
		this.connected = false;
		this.startingActionId = 1;
		this.init();
	}

	init() {
		this.ws = new WebSocket(this.url);
		this.ws.addEventListener('open', () => {
			console.log('[WS] Connected');
			this.connected = true;
			this.flushQueue();
		});
		this.ws.addEventListener('message', (evt) => {
			try {
				const msg = JSON.parse(evt.data);
				if (msg.type === 'hello' && msg.startingActionId !== undefined) {
					this.startingActionId = msg.startingActionId;
					console.log('[WS] Starting action ID:', this.startingActionId);
				}
			} catch (e) {
				console.warn('[WS] Failed to parse incoming message', e);
			}
		});
		this.ws.addEventListener('close', () => {
			console.log('[WS] Closed, reconnecting...');
			this.connected = false;
			setTimeout(() => this.init(), 1000);
		});
	}

	flushQueue() {
		while (this.queue.length > 0 && this.connected) {
			const { action, actionId } = this.queue.shift();
			this.sendJSON(action, actionId);
		}
	}

	sendJSON(action, actionId) {
		const payload = JSON.stringify(Object.assign({ actionId: actionId, timestamp: Date.now() }, action));
		if (this.connected) {
			this.ws.send(payload);
		} else {
			this.queue.push({ action, actionId });
		}
	}

	send(action) {
		const id = this.startingActionId++;
		if (this.connected) {
			this.sendJSON(action, id);
		} else {
			this.queue.push({ action, actionId: id });
		}
	}

	close() {
		this.ws.close();
	}
}

// ----------------------------
// Telemetry Client
// ----------------------------
class TelemetryClient {
	constructor(transport) {
		this.transport = transport;
		this.nextActionId = 1;
	}

	initialize() {
		this.nextActionId = this.transport.startingActionId;
	}

	push(action) {
		this.transport.send(action);
		this.nextActionId++;
	}

	shutdown() {
		this.transport.close();
	}
}

const telemetryUrl = `wss://dashboard-testing.remora.llc/global/api/v1/analysis/file/${fileId}`;
app.socket = new WebSocketTransport(telemetryUrl);
app.telemetry = new TelemetryClient(app.socket);
app.telemetry.initialize();
console.log('[TELEMETRY] Initialized');

/* eslint-disable no-unused-vars */
function trackEditAction(type) {
	app.telemetry.push({ hazard: app.HazardFlag.Edit, type: 'Edit', action_type: type });
}
function trackPasteAction(text, actionType, cited, format) {
	app.telemetry.push({
		hazard: app.HazardFlag.Paste,
		type: 'Paste',
		text,
		action_type: actionType,
		cited,
		format
	});
}
function trackTypingAction(text, wpm, cpm, actionType) {
	app.telemetry.push({
		hazard: app.HazardFlag.Typing,
		type: 'Typing',
		text,
		wpm,
		cpm,
		action_type: actionType
	});
}
function trackWindowAction(state, sizePct) {
	app.telemetry.push({
		hazard: app.HazardFlag.Window,
		type: 'Window',
		window_state: state,
		size_percentage: sizePct
	});
}
function trackNudgeAction(accept, contentType, text) {
	app.telemetry.push({
		hazard: app.HazardFlag.Nudge,
		type: 'Nudge',
		accept_message: accept,
		content_type: contentType,
		text
	});
}
/* eslint-disable no-unused-vars */

////// Map Creation //////

console.log('[MAP] Creating map with options:', {
	server: host,
	doc: docURL,
	docParams,
	timestamp,
	docTarget: target,
	debug: debugMode,
	wopi: isWopi,
	wopiSrc,
	notWopiButIframe,
	alwaysActive,
	idleTimeoutSecs,
	outOfFocusTimeoutSecs
});

var map = window.L.map('map', {
	server: host,
	doc: docURL,
	docParams,
	timestamp,
	docTarget: target,
	documentContainer: 'document-container',
	debug: debugMode,
	wopi: isWopi,
	wopiSrc,
	notWopiButIframe,
	alwaysActive,
	idleTimeoutSecs,
	outOfFocusTimeoutSecs
});

////// Controls /////

map.uiManager = new UIManager();
map.addControl(map.uiManager);

if (!window.L.Browser.cypressTest) {
	console.log('[UI] Tooltip enabled');
	map.tooltip = window.L.control.tooltip();
}

map.uiManager.initializeBasicUI();

if (wopiSrc === '' && filePath === '' && !window.ThisIsAMobileApp) {
	console.warn('[ERROR] Missing WOPISrc and file_path');
	map.uiManager.showInfoModal(
		'wrong-wopi-src-modal', '',
		errorMessages.wrongwopisrc, '',
		_('OK'), null, false
	);
}

if (host === '' && !window.ThisIsAMobileApp) {
	console.warn('[ERROR] Empty host URL');
	map.uiManager.showInfoModal(
		'empty-host-url-modal', '',
		errorMessages.emptyhosturl, '',
		_('OK'), null, false
	);
}

window.L.Map.THIS = map;
app.map = map;
app.idleHandler.map = map;

if (window.ThisIsTheEmscriptenApp) {
	console.log('[EMS] Running in Emscripten mode');
	var docParamsString = $.param(docParams);
	console.log('[EMS] docParamsString:', docParamsString);

	var docParamsPart = docParamsString
		? (docURL.includes('?') ? '&' : '?') + docParamsString
		: '';

	console.log('[EMS] docParamsPart:', docParamsPart);

	var encodedWOPI = encodeURIComponent(docURL + docParamsPart);
	console.log('[EMS] encodedWOPI:', encodedWOPI);

	globalThis.Module = createEmscriptenModule(
		isWopi ? 'server' : 'local',
		isWopi ? encodedWOPI : docURL
	);

	globalThis.Module.onRuntimeInitialized = function () {
		console.log('[EMS] Runtime initialized, loading document');
		map.loadDocument(global.socket);
	};

	createOnlineModule(globalThis.Module);
} else {
	console.log('[MAP] Loading document directly');
	map.loadDocument(global.socket);
}

window.addEventListener('beforeunload', function () {
	console.log('[LIFECYCLE] beforeunload triggered');
	if (map && app.socket) {
		if (app.socket.setUnloading) {
			console.log('[SOCKET] setUnloading');
			app.socket.setUnloading();
		}
		console.log('[SOCKET] closing');
		app.socket.close();
	}
});

window.bundlejsLoaded = true;
console.log('[INIT] bundle complete');

////// Unsupported Browser Warning /////

var uaLowerCase = navigator.userAgent.toLowerCase();
console.log('[UA] userAgent:', uaLowerCase);

if (uaLowerCase.indexOf('msie') != -1 || uaLowerCase.indexOf('trident') != -1) {
	console.warn('[UA] Unsupported browser detected');
	map.uiManager.showInfoModal(
		'browser-not-supported-modal', '',
		_('Warning! The browser you are using is not supported.'),
		'', _('OK'), null, false
	);
}

})(window);