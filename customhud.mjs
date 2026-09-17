import { Plugin } from 'plugify';
import * as s2sdk from ':s2sdk';

const pluginTag = "CustomHud"

let scriptReady = false;
let csScript = null;
const huds = new Map(); // name -> entityHandle (s2sdk)
const hudClickListeners = new Set();
const csScriptReadyListeners = new Set();
let hudClicksHooked = false;

function instance() {
	return csScript.Instance;
}

function importCsScript() {
	import('cs_script/point_script')
		.then((point_script) => {
			csScript = point_script;
			scriptReady = true;
			console.log(`[${pluginTag}] CS Script connected successfully.`);
			hookHudClicks();

			for (const callback of csScriptReadyListeners) {
				callback();
			}
		})
		.catch((err) => {
			console.log(`[${pluginTag}] CS Script isn't available: ${err}`);
		});
}

function onEntitySpawned(entityHandle) {
	if (scriptReady) {
		return;
	}

	if (s2sdk.GetEntityClassname(entityHandle) === 'point_script') {
		s2sdk.QueueTaskForNextFrame(function () {
			importCsScript();
		}, [])
	}
}

function hookHudClicks() {
	if (hudClicksHooked) {
		return;
	}

	hudClicksHooked = true;

	instance().OnCustomHudClicked((event) => {
		const name = event.layout.GetEntityName();
		const playerSlot = event.player.GetPlayerSlot();

		for (const callback of hudClickListeners) {
			callback(playerSlot, name, event.buttonId);
		}
	});
}

function OnMapEnd() {
	scriptReady = false;
	csScript = null;
	hudClicksHooked = false;
	huds.clear();
}

export class CustomHud extends Plugin {
	pluginStart() {
		s2sdk.OnMapEnd_Register(OnMapEnd)
		s2sdk.OnEntitySpawned_Register(onEntitySpawned);
	}
}

function findHud(name) {
	if (!scriptReady) {
		return undefined;
	}

	return instance().FindEntityByName(name);
}

function callHud(name, fn) {
	const layout = findHud(name);
	if (!layout) {
		return false;
	}

	try {
		fn(layout);
		return true;
	} catch (err) {
		console.log(`[${pluginTag}] CustomHudLayout(${name}) failed: ${err}`);
		return false;
	}
}

const hudSetter = (methodName) => (name, ...args) => callHud(name, (layout) => layout[methodName](...args));
const hudGetter = (methodName, fallback) => (name, ...args) => {
	const layout = findHud(name);

	return layout ? layout[methodName](...args) : fallback;
};

/**
 * Checks whether the CS Script system has come up and the plugin is
 * connected to it.
 */
export const IsCsScriptReady = () => scriptReady;

/**
 * Subscribes a callback to be called every time CS Script comes up (once per
 * map, since it has to reconnect after every map change). If CS Script is
 * already ready at the time of registration, the callback fires immediately.
 */
export const OnCsScriptReady_Register = (callback) => {
	csScriptReadyListeners.add(callback);

	if (scriptReady) {
		callback();
	}
};

/** Removes a callback previously added with OnCsScriptReady_Register. */
export const OnCsScriptReady_Unregister = (callback) => {
	csScriptReadyListeners.delete(callback);
};

/**
 * CreateCustomHud only creates the entity — the panel isn't built on the
 * client yet. The client appears to assemble it lazily, on the first state
 * update it receives: without at least one SetHudHasClass/SetHudDialogVariable
 * call after creation the panel may never appear at all, even if the css
 * says it should be visible immediately (opacity: 1, no hiding class). Call
 * one of those methods at least once before expecting a player to see the hud.
 */
export const CreateCustomHud = (name, layoutResource) => {
	const entityHandle = s2sdk.CreateEntityByName('custom_hud_layout');
	if (entityHandle === -1) {
		return false;
	}

	s2sdk.DispatchSpawn2(entityHandle, ['targetname', 'layout'], [name, layoutResource]);
	huds.set(name, entityHandle);

	return true;
};

/**
 * Removes a previously created custom_hud_layout and forgets its handle.
 */
export const RemoveCustomHud = (name) => {
	const entityHandle = huds.get(name);
	if (entityHandle === undefined) {
		return false;
	}

	s2sdk.RemoveEntity(entityHandle);
	huds.delete(name);

	return true;
};

/**
 * Hides the hud entity from all players except the owner, at the
 * transmit/PVS level. This is a different, stronger guarantee than a
 * per-player CSS class (see SetHudHasClassForPlayer below): a CSS class only
 * hides the panel on clients the entity is still transmitted to, while this
 * stops the entity from reaching other clients' entity lists at all.
 */
export const HideCustomHudFromOtherPlayers = (name, playerSlot) => {
	const entityHandle = huds.get(name);
	if (entityHandle === undefined) {
		return false;
	}

	s2sdk.HideTransmitEntityFromOtherPlayers(playerSlot, entityHandle);

	return true;
};

/**
 * Set if a panel has a class. Applies to all players.
 * Omit `hasClass` to revert to the original value.
 */
export const SetHudHasClass = hudSetter('SetHasClass');

/**
 * Set if a panel has a class for a single player. Will override the all player value.
 * Omit `hasClass` to defer to the all player value.
 */
export const SetHudHasClassForPlayer = hudSetter('SetHasClassForPlayer');

/**
 * Set the value of a dialog variable. Applies to all players.
 */
export const SetHudDialogVariable = hudSetter('SetDialogVariableString');

/**
 * Set the value of a dialog variable for a single player. Will override the all player value.
 * Omit `value` to defer to the all player value. If no all player value has been set, the value will be an empty string.
 */
export const SetHudDialogVariableForPlayer = hudSetter('SetDialogVariableStringForPlayer');

/**
 * Set to true to force a player into cursor mode and enable click detection on the panels of this layout.
 * Set a callback with Instance.OnCustomHudClicked to listen for clicks.
 * Multiple CustomHudLayouts can have input captured at a time.
 * Players will get movement control back once all CustomHudLayouts have disabled input capture.
 */
export const SetHudInputCapture = hudSetter('SetInputCaptureEnabled');

/**
 * Get if this CustomHudLayout is capturing input for a player
 */
export const IsHudInputCaptureEnabled = hudGetter('IsInputCaptureEnabled', false);

/**
 * Subscribes a callback to clicks on any button of any hud created via
 * CreateCustomHud. Called as (playerSlot, hudName, buttonId).
 */
export const OnHudClicked_Register = (callback) => {
	hudClickListeners.add(callback);
};

/** Removes a callback previously added with OnHudClicked_Register. */
export const OnHudClicked_Unregister = (callback) => {
	hudClickListeners.delete(callback);
};
