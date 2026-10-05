import { Plugin } from 'plugify';
import * as s2sdk from ':s2sdk';

const pluginTag = "CustomHud";
const LOOKUP_SCRIPT_INPUT = 'customhud_lookup';

let instance = null; // cs_script Instance, null until CS Script is ready
let lookupResult; // entity passed to the last LOOKUP_SCRIPT_INPUT
const layouts = new Map(); // hud handle (s2sdk) -> cs_script CustomHudLayout
const hudClickListeners = new Set();
const csScriptReadyListeners = new Set();

function notify(listenerName, callback, ...args) {
	try {
		callback(...args);
	} catch (err) {
		console.log(`[${pluginTag}] ${listenerName} listener failed: ${err}`);
	}
}

function importCsScript() {
	import('cs_script/point_script')
		.then((point_script) => {
			instance = point_script.Instance;
			console.log(`[${pluginTag}] CS Script connected successfully.`);

			instance.OnScriptInput(LOOKUP_SCRIPT_INPUT, ({ caller }) => {
				lookupResult = caller;
			});

			instance.OnCustomHudClicked((event) => {
				const hud = [...layouts].find(([, layout]) => layout === event.layout)?.[0];
				if (hud === undefined) {
					return;
				}

				for (const callback of hudClickListeners) {
					notify('OnHudClicked', callback, event.player.GetPlayerSlot(), hud, event.buttonId);
				}
			});

			for (const callback of csScriptReadyListeners) {
				notify('OnCsScriptReady', callback);
			}
		})
		.catch((err) => {
			console.log(`[${pluginTag}] CS Script isn't available: ${err}`);
		});
}

function onEntitySpawned(entityHandle) {
	if (instance || entityHandle !== s2sdk.GetPointScriptHandle()) {
		return;
	}

	s2sdk.QueueTaskForNextFrame(importCsScript, []);
}

function onMapEnd() {
	instance = null;
	layouts.clear();
}

export class CustomHud extends Plugin {
	pluginStart() {
		s2sdk.OnServerActivate_Register(onServerActivate);
		s2sdk.OnMapEnd_Register(onMapEnd);
		s2sdk.OnEntitySpawned_Register(onEntitySpawned);
	}

	pluginEnd() {
		s2sdk.OnServerActivate_Unregister(onServerActivate);
		s2sdk.OnMapEnd_Unregister(onMapEnd);
		s2sdk.OnEntitySpawned_Unregister(onEntitySpawned);
	}
}

function isHud(hud) {
	return s2sdk.IsValidEntHandle(hud) && s2sdk.GetEntityClassname(hud) === 'custom_hud_layout';
}

/**
 * Get the cs_script entity of a handle. cs_script has no lookup by handle, so the entity is sent
 * as the caller of a RunScriptInput, which OnScriptInput receives synchronously as a cs_script object.
 */
function getEntityByHandle(handle) {
	const pointScript = s2sdk.GetPointScriptHandle();
	if (!instance || !s2sdk.IsValidEntHandle(pointScript)) {
		return undefined;
	}

	lookupResult = undefined;
	s2sdk.AcceptEntityInput(pointScript, 'RunScriptInput', handle, handle, LOOKUP_SCRIPT_INPUT, s2sdk.FieldType.String, 0);

	return lookupResult?.IsValid() ? lookupResult : undefined;
}

/**
 * Cached by handle, so clicks can be mapped back to the hud.
 */
function getLayout(hud) {
	if (!isHud(hud)) {
		return undefined;
	}

	let layout = layouts.get(hud);
	if (!layout) {
		layout = getEntityByHandle(hud);
		if (layout) {
			layouts.set(hud, layout);
		}
	}

	return layout;
}

function callHud(hud, fn) {
	const layout = getLayout(hud);
	if (!layout) {
		return false;
	}

	try {
		fn(layout);
		return true;
	} catch (err) {
		console.log(`[${pluginTag}] CustomHudLayout(${hud}) failed: ${err}`);
		return false;
	}
}

/**
 * CustomHudLayout has no getter for classes, so they are read from the entity:
 * each state keeps `m_vecHasClasses`, records that reference `m_vecPanelIds` and `m_vecClassNames` by index.
 */
const LAYOUT_CLASS = 'CCSCustomHudLayout';
const STATE_CLASS = 'CCSCustomHudLayoutState';

// EHudPanelClassStatus_t
const CLASS_STATUS_UNDEFINED = -1;
const CLASS_STATUS_HAS_CLASS = 1;

let hasClassOffsets = null; // HUDPanelHasClass_t field offsets, null if the schema is missing a field

function onServerActivate() {
	const offsets = {
		panelIdIndex: s2sdk.GetSchemaOffset('HUDPanelHasClass_t', 'm_nPanelIdIndex'),
		classNameIndex: s2sdk.GetSchemaOffset('HUDPanelHasClass_t', 'm_nClassNameIndex'),
		classStatus: s2sdk.GetSchemaOffset('HUDPanelHasClass_t', 'm_eClassStatus'),
	};

	if (Object.values(offsets).some((offset) => offset < 0)) {
		console.log(`[${pluginTag}] HUDPanelHasClass_t schema is missing expected fields: ${JSON.stringify(offsets)}`);
		hasClassOffsets = null;
		return;
	}

	hasClassOffsets = offsets;
}

function indexOfName(entity, memberName, name) {
	const count = s2sdk.GetEntSchemaArraySize2(entity, LAYOUT_CLASS, memberName);
	for (let i = 0; i < count; i++) {
		if (s2sdk.GetEntSchemaString2(entity, LAYOUT_CLASS, memberName, i) === name) {
			return i;
		}
	}

	return -1;
}

function classStatus(state, panelIndex, classIndex) {
	const count = state === 0n ? 0 : s2sdk.GetEntSchemaArraySize2(state, STATE_CLASS, 'm_vecHasClasses');
	for (let i = 0; i < count; i++) {
		const entry = s2sdk.GetEntSchemaPtr2(state, STATE_CLASS, 'm_vecHasClasses', i);
		const read = (offset, size) => Number(s2sdk.GetEntData2(entry, offset, size));

		if ((read(hasClassOffsets.panelIdIndex, 2) & 0xFFFF) === panelIndex
			&& (read(hasClassOffsets.classNameIndex, 2) & 0xFFFF) === classIndex) {
			return read(hasClassOffsets.classStatus, 4);
		}
	}

	return CLASS_STATUS_UNDEFINED;
}

/**
 * Get if CS Script is ready.
 */
export const IsCsScriptReady = () => instance !== null;

/**
 * Called every time CS Script comes up, once per map. Fires immediately if it is already ready.
 */
export const OnCsScriptReady_Register = (callback) => {
	csScriptReadyListeners.add(callback);

	if (instance) {
		notify('OnCsScriptReady', callback);
	}
};

export const OnCsScriptReady_Unregister = (callback) => {
	csScriptReadyListeners.delete(callback);
};

/**
 * Create a hud and get its handle, or -1 if it could not be created.
 * The handle stays valid until the hud is removed or the map changes. The name does not have to be unique.
 */
export const CreateCustomHud = (name, layoutResource) => {
	// An empty string value crashes DispatchSpawn2 in s2sdk.
	if (layoutResource === '') {
		console.log(`[${pluginTag}] CreateCustomHud: layoutResource is empty.`);
		return -1;
	}

	const hud = s2sdk.CreateEntityByName('custom_hud_layout');
	if (hud === -1) {
		return -1;
	}

	if (name === '') {
		s2sdk.DispatchSpawn2(hud, ['layout'], [layoutResource]);
	} else {
		s2sdk.DispatchSpawn2(hud, ['targetname', 'layout'], [name, layoutResource]);
	}

	return hud;
};

/**
 * Get the handle of the first hud with this name, or -1.
 */
export const FindCustomHud = (name) => {
	if (name === '') {
		return -1;
	}

	const hud = s2sdk.FindEntityByName(-1, name);

	return isHud(hud) ? hud : -1;
};

export const RemoveCustomHud = (hud) => {
	if (!isHud(hud)) {
		return false;
	}

	s2sdk.RemoveEntity(hud);
	layouts.delete(hud);

	return true;
};

/**
 * Stop transmitting the hud to everyone except `playerSlot`. Unlike a CSS class, other players don't receive it at all.
 */
export const HideCustomHudFromOtherPlayers = (hud, playerSlot) => {
	if (!isHud(hud)) {
		return false;
	}

	s2sdk.HideTransmitEntityFromOtherPlayers(playerSlot, hud);

	return true;
};

/**
 * Set if a panel has a class. Applies to all players.
 */
export const SetHudHasClass = (hud, panelId, className, hasClass) =>
	callHud(hud, (layout) => layout.SetHasClass(panelId, className, hasClass));

/**
 * Revert a panel's class to the original value from the layout.
 */
export const ResetHudHasClass = (hud, panelId, className) =>
	callHud(hud, (layout) => layout.SetHasClass(panelId, className));

/**
 * Set if a panel has a class for a single player. Will override the all player value.
 */
export const SetHudHasClassForPlayer = (hud, playerSlot, panelId, className, hasClass) =>
	callHud(hud, (layout) => layout.SetHasClassForPlayer(playerSlot, panelId, className, hasClass));

/**
 * Remove a single player's value of a panel's class, so the all player value applies again.
 */
export const ResetHudHasClassForPlayer = (hud, playerSlot, panelId, className) =>
	callHud(hud, (layout) => layout.SetHasClassForPlayer(playerSlot, panelId, className));

/**
 * Get if a panel has a class for a player: the player value if set, otherwise the all player value.
 * Pass -1 for `playerSlot` to check the all player value only. Classes from the layout file are not reported. (Panel.BHasClass)
 */
export const BHasClass = (hud, playerSlot, panelId, className) => {
	if (!hasClassOffsets || !isHud(hud)) {
		return false;
	}

	const entity = s2sdk.EntHandleToEntPointer(hud);

	const panelIndex = indexOfName(entity, 'm_vecPanelIds', panelId);
	const classIndex = indexOfName(entity, 'm_vecClassNames', className);
	if (panelIndex === -1 || classIndex === -1) {
		return false;
	}

	let status = CLASS_STATUS_UNDEFINED;
	if (playerSlot !== -1) {
		const playerState = s2sdk.GetEntSchemaPtr2(entity, LAYOUT_CLASS, 'm_vecPlayerLayoutStates', playerSlot);
		status = classStatus(playerState, panelIndex, classIndex);
	}

	if (status === CLASS_STATUS_UNDEFINED) {
		const globalState = s2sdk.GetEntSchemaPtr2(entity, LAYOUT_CLASS, 'm_globalLayoutState', 0);
		status = classStatus(globalState, panelIndex, classIndex);
	}

	return status === CLASS_STATUS_HAS_CLASS;
};

/**
 * Toggle a class on a panel, based on BHasClass. Pass -1 for `playerSlot` to toggle the all player value. (Panel.ToggleClass)
 */
export const ToggleClass = (hud, playerSlot, panelId, className) => {
	const hasClass = !BHasClass(hud, playerSlot, panelId, className);

	return playerSlot === -1
		? SetHudHasClass(hud, panelId, className, hasClass)
		: SetHudHasClassForPlayer(hud, playerSlot, panelId, className, hasClass);
};

/**
 * Set the value of a dialog variable. Applies to all players.
 */
export const SetHudDialogVariable = (hud, panelId, variableName, value) =>
	callHud(hud, (layout) => layout.SetDialogVariableString(panelId, variableName, value));

/**
 * Set the value of a dialog variable for a single player. Will override the all player value.
 */
export const SetHudDialogVariableForPlayer = (hud, playerSlot, panelId, variableName, value) =>
	callHud(hud, (layout) => layout.SetDialogVariableStringForPlayer(playerSlot, panelId, variableName, value));

/**
 * Remove a single player's value of a dialog variable, so the all player value applies again.
 * If no all player value has been set, the value will be an empty string.
 */
export const ResetHudDialogVariableForPlayer = (hud, playerSlot, panelId, variableName) =>
	callHud(hud, (layout) => layout.SetDialogVariableStringForPlayer(playerSlot, panelId, variableName));

/**
 * Set to true to force a player into cursor mode and enable click detection on the panels of this hud.
 * Players get movement control back once all huds have disabled input capture.
 */
export const SetHudInputCapture = (hud, playerSlot, enabled) =>
	callHud(hud, (layout) => layout.SetInputCaptureEnabled(playerSlot, enabled));

/**
 * Get if this hud is capturing input for a player.
 */
export const IsHudInputCaptureEnabled = (hud, playerSlot) => {
	let enabled = false;
	callHud(hud, (layout) => {
		enabled = layout.IsInputCaptureEnabled(playerSlot);
	});

	return enabled;
};

/**
 * Reset to original state for all players.
 */
export const ResetHud = (hud) => callHud(hud, (layout) => layout.Reset());

/**
 * Reset a single player's overrides to their original state.
 */
export const ResetHudForPlayer = (hud, playerSlot) => callHud(hud, (layout) => layout.ResetForPlayer(playerSlot));

/**
 * Called on a click on any button of any hud, as (playerSlot, hud, buttonId).
 */
export const OnHudClicked_Register = (callback) => {
	hudClickListeners.add(callback);
};

export const OnHudClicked_Unregister = (callback) => {
	hudClickListeners.delete(callback);
};
