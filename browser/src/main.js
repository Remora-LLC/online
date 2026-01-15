/* -*- js-indent-level: 8 -*- */

/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* global globalThis UIManager */
/* global errorMessages accessToken accessTokenTTL noAuthHeader accessHeader createOnlineModule */
/* global app $ host idleTimeoutSecs outOfFocusTimeoutSecs _ LocaleService LayoutingService */
/* global ServerConnectionService createEmscriptenModule */
/*eslint indent: [error, "tab", { "outerIIFEBody": 0 }]*/

import { TelemetryClient, WebSocketTransport } from '@remora-llc/telemetry';

(function (global) {

console.log('[INIT] bundle start');

var wopiParams = {};
var wopiSrc = global.coolParams.get('WOPISrc');

// Parse file ID from WOPISrc
var fileId = null;

if (wopiSrcRaw) {
	try {
		var url = new URL(wopiSrcRaw);
		var parts = url.pathname.split('/').filter(Boolean);

		// Expected path: /wopi/files/<fileId>
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
}
else if (wopiSrc !== '' && accessHeader !== '') {
	console.log('[WOPI] Using access_header authentication');
	wopiParams = { 'access_header': accessHeader };
}
else {
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

if (wopiSrc != '') {
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

var notWopiButIframe = global.coolParams.get('NotWOPIButIframe') != '';
console.log('[PARAM] NotWOPIButIframe:', notWopiButIframe);

console.log('[MAP] Creating map with options:', {
	server: host,
	doc: docURL,
	docParams: docParams,
	timestamp: timestamp,
	docTarget: target,
	debug: debugMode,
	wopi: isWopi,
	wopiSrc: wopiSrc,
	notWopiButIframe: notWopiButIframe,
	alwaysActive: alwaysActive,
	idleTimeoutSecs: idleTimeoutSecs,
	outOfFocusTimeoutSecs: outOfFocusTimeoutSecs
});

var map = window.L.map('map', {
	server: host,
	doc: docURL,
	docParams: docParams,
	timestamp: timestamp,
	docTarget: target,
	documentContainer: 'document-container',
	debug: debugMode,
	wopi: isWopi,
	wopiSrc: wopiSrc,
	notWopiButIframe: notWopiButIframe,
	alwaysActive: alwaysActive,
	idleTimeoutSecs: idleTimeoutSecs,
	outOfFocusTimeoutSecs: outOfFocusTimeoutSecs,
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

	globalThis.Module.onRuntimeInitialized = function() {
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

}(window));
