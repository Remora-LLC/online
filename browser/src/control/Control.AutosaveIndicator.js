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

/* global $ _ */

window.L.Control.AutosaveIndicator = window.L.Control.extend({

	onAdd: function (map) {
		this.map = map;
		this._isSaving = false;
		this._indicator = null;

		// Create the indicator element
		this._createIndicator();

		// Listen to save status events
		map.on('statusindicator', this._onStatusIndicator, this);
		map.on('remove', this.onRemove, this);

		return this._indicator;
	},

	onRemove: function () {
		this.map.off('statusindicator', this._onStatusIndicator, this);
		this.map.off('remove', this.onRemove, this);
		if (this._indicator && this._indicator.parentNode) {
			this._indicator.parentNode.removeChild(this._indicator);
		}
	},

	_createIndicator: function () {
		var toolbarUp = document.getElementById('toolbar-up');
		if (!toolbarUp) {
			// Toolbar not ready yet, try again later
			setTimeout(this._createIndicator.bind(this), 100);
			return;
		}

		// Create indicator element
		this._indicator = document.createElement('div');
		this._indicator.id = 'autosave-indicator';
		this._indicator.className = 'autosave-indicator';
		this._indicator.innerHTML = '<span class="autosave-text"></span><span class="autosave-spinner"></span>';

		// Insert it at the beginning of the toolbar
		if (toolbarUp.firstChild) {
			toolbarUp.insertBefore(this._indicator, toolbarUp.firstChild);
		} else {
			toolbarUp.appendChild(this._indicator);
		}

		// Initially hidden
		this._indicator.style.display = 'none';
	},

	_onStatusIndicator: function (e) {
		// Only show for background saves (autosaves)
		if (!e.background) {
			return;
		}

		switch (e.statusType) {
		case 'start':
			this._showSaving();
			break;
		case 'setvalue':
			// Update progress if needed
			break;
		case 'finish':
			this._showSaved();
			break;
		}
	},

	_showSaving: function () {
		if (!this._indicator) {
			this._createIndicator();
		}
		if (!this._indicator) return;

		this._isSaving = true;
		this._indicator.style.display = 'flex';
		this._indicator.className = 'autosave-indicator saving';
		var textEl = this._indicator.querySelector('.autosave-text');
		if (textEl) {
			textEl.textContent = _('Autosaving...');
		}
	},

	_showSaved: function () {
		if (!this._indicator) return;

		this._isSaving = false;
		this._indicator.className = 'autosave-indicator saved';
		var textEl = this._indicator.querySelector('.autosave-text');
		if (textEl) {
			textEl.textContent = _('Autosaved');
		}

		// Hide after a delay
		var self = this;
		setTimeout(function () {
			if (self._indicator && !self._isSaving) {
				self._indicator.style.display = 'none';
			}
		}, 2000);
	},

});

window.L.control.autosaveIndicator = function (options) {
	return new window.L.Control.AutosaveIndicator(options);
};
