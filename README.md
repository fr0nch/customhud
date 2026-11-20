[![Русский](https://img.shields.io/badge/Русский-%F0%9F%87%B7%F0%9F%87%BA-green?style=for-the-badge)](README_ru.md)

# CS2 Custom Hud API

A [Plugify](https://github.com/untrustedmodders/plugify) plugin that lets other plugins (any language: Go, C++, Python, JS) control a custom HUD (`custom_hud_layout`) in CS2.

## Why

A hud (`custom_hud_layout`) can only be created by the map itself or by `cs_script`. A regular server plugin can't do it directly. And once created, controlling it (CSS classes, variables, clicks) is only possible from inside `cs_script`.
This plugin takes care of that for you: it creates the hud through `s2sdk`, tracks `cs_script` itself, and exposes simple functions (`CreateCustomHud`, `SetHudHasClass`, etc.) any other plugin can call, without needing its own `cs_script` file.

## Requirements

- [Source 2 SDK](https://github.com/untrustedmodders/plugify-plugin-s2sdk) plugin 3.0.0 or newer
- [V8 language module for JavaScript](https://github.com/untrustedmodders/plugify-module-v8)

## Usage

```js
// From any Plugify plugin. Everything below needs cs_script, so it all
// waits for OnCsScriptReady_Register. It fires immediately if already ready.
OnCsScriptReady_Register(() => {
	const hud = CreateCustomHud('main_hud', 'panorama/layout/custom_game/main_hud.xml');

	// Set a class for all players:
	SetHudHasClass(hud, 'dialog', 'Dismissed', false);

	// A per-player value overrides the shared one:
	SetHudHasClassForPlayer(hud, playerSlot, 'dialog', 'Dismissed', true);

	// Let a player click buttons on the hud:
	SetHudInputCapture(hud, playerSlot, true);
});

OnHudClicked_Register((playerSlot, hud, buttonId) => {
	// handle click
});
```
## API reference

| Method | Description |
|---|---|
| `IsCsScriptReady()` | Whether `cs_script` is ready. |
| `OnCsScriptReady_Register(callback)` | Subscribes to `cs_script` becoming ready. Fires immediately if it already is. |
| `OnCsScriptReady_Unregister(callback)` | Unsubscribes. |
| `CreateCustomHud(name, layoutResource)` | Creates a hud and returns its handle (`-1` on failure). All other methods take this handle. It stays valid until the hud is removed or the map changes. The name does not have to be unique. |
| `CreateObservableCustomHud(name, layoutResource)` | Same as `CreateCustomHud`, but every player receives the per-player values of all players, so a spectator sees the hud of the player being observed (without a cursor). |
| `FindCustomHud(name)` | Returns the handle of the first hud with this name, such as one placed on the map (`-1` if not found). |
| `RemoveCustomHud(hud)` | Removes a hud. |
| `HideCustomHudFromOtherPlayers(hud, playerSlot)` | Stops sending the hud to everyone except `playerSlot`. See the note on hiding below. |
| `HideCustomHud(hud, playerSlot)` | Stops sending the hud to one player until `ShowCustomHud`. See the note on hiding below. |
| `ShowCustomHud(hud, playerSlot)` | Sends the hud to a player again after `HideCustomHud` or `HideCustomHudFromOtherPlayers`. |
| `SetHudHasClass(hud, panelId, className, hasClass)` | Adds/removes a CSS class on a panel, for all players. |
| `ResetHudHasClass(hud, panelId, className)` | Reverts a panel's class to the original value from the layout, for all players. |
| `SetHudHasClassForPlayer(hud, playerSlot, panelId, className, hasClass)` | Same, but for one player only. |
| `ResetHudHasClassForPlayer(hud, playerSlot, panelId, className)` | Removes one player's value, so the shared one applies again. |
| `BHasClass(hud, playerSlot, panelId, className)` | Whether a panel has a class for a player. The player value is used if set, otherwise the all player value (`-1` checks only the all player value). Classes from the layout `.xml` are not reported. |
| `ToggleClass(hud, playerSlot, panelId, className)` | Toggles a class, based on `BHasClass`. `-1` toggles the all player value. |
| `SetHudDialogVariable(hud, panelId, variableName, value)` | Sets a panel variable, for all players. |
| `SetHudDialogVariableForPlayer(hud, playerSlot, panelId, variableName, value)` | Same, but for one player only. |
| `ResetHudDialogVariableForPlayer(hud, playerSlot, panelId, variableName)` | Removes one player's value of a variable, so the shared one applies again. |
| `GetHudDialogVariable(hud, playerSlot, panelId, variableName)` | The value of a variable for a player. The player value is used if set, otherwise the all player value (`-1` reads only the all player value). Empty string if not set. |
| `SetHudInputCapture(hud, playerSlot, enabled)` | Turns a player's cursor/clicks on the hud on or off. |
| `IsHudInputCaptureEnabled(hud, playerSlot)` | Whether a player's input is currently captured. |
| `ResetHud(hud)` | Resets the hud to its original state for all players. |
| `ResetHudForPlayer(hud, playerSlot)` | Resets one player's overrides to the original state. |
| `OnHudClicked_Register(callback)` | Subscribes to button clicks on a hud. |
| `OnHudClicked_Unregister(callback)` | Unsubscribes from clicks. |

## Important

- A hud doesn't survive a map change. Call `CreateCustomHud` again on the new map.
- Pass the layout's source name: `panorama/layout/custom_game/main_hud.xml`. With `.vxml` the client logs `Layout xml is an invalid resource name` and draws nothing.
- A layout from your own addon has to be in the session manifest: in `OnBuildGameSessionManifest` call `Precache` with the compiled names, `panorama/layout/custom_game/main_hud.vxml` and `panorama/styles/custom_game/main_hud.vcss`.
- Values set for one player (`...ForPlayer`) reach only that player. An observable hud sends them to everyone.
- Hiding (`HideCustomHud`, `HideCustomHudFromOtherPlayers`) works only for players who haven't received the hud yet, so call it in the same tick as `CreateCustomHud`. A hud already on a player's screen stays there and just stops updating until `ShowCustomHud`. s2sdk clears every hide on round start, so hide the hud again after it.
- The server does not check input capture when a click arrives, so a modified client can report any `buttonId`. Check `buttonId` and the player's state on the server.
- In a variable value, `#Token` and a bare token name (`SFUI_WPNHUD_AK47`) are translated into each player's language. `{g:csgo_key:var}` in a label turns `%+use%` in the value into the player's key. `{g:player_name:var}` does not work with a value from the server: it always shows the player in slot 0 and outputs HTML.
- Valve's official `CustomHudLayout` documentation is in [`pps/point_script.d.ts`](pps/point_script.d.ts).

## License

[MIT](LICENSE).
