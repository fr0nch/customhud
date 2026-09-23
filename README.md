[![Русский](https://img.shields.io/badge/Русский-%F0%9F%87%B7%F0%9F%87%BA-green?style=for-the-badge)](README_ru.md)

# CS2 Custom Hud API

A [Plugify](https://github.com/untrustedmodders/plugify) plugin that lets other plugins (any language: Go, C++, Python, JS) control a custom HUD (`custom_hud_layout`) in CS2.

## Why

A hud (`custom_hud_layout`) can only be created by the map itself or by `cs_script`. A regular server plugin can't do it directly. And once created, controlling it (CSS classes, variables, clicks) is only possible from inside `cs_script`.
This plugin takes care of that for you: it creates the hud through `s2sdk`, tracks `cs_script` itself, and exposes simple functions (`CreateCustomHud`, `SetHudHasClass`, etc.) any other plugin can call, without needing its own `cs_script` file.

## Requirements

- [Source 2 SDK](https://github.com/untrustedmodders/plugify) plugin
- [V8 language module for JavaScript](https://github.com/untrustedmodders/plugify)

## Usage

```js
// From any Plugify plugin. Everything below needs cs_script, so it all
// waits for OnCsScriptReady_Register — it fires immediately if already ready.
OnCsScriptReady_Register(() => {
	CreateCustomHud('main_hud', 'panorama/layout/custom_game/main_hud.vxml');

	// The panel doesn't appear right away. Call at least one Set* method
	// before expecting a player to see it:
	SetHudHasClass('main_hud', 'dialog', 'Dismissed', false);

	// A per-player value overrides the shared one:
	SetHudHasClassForPlayer('main_hud', playerSlot, 'dialog', 'Dismissed', true);

	// Let a player click buttons on the hud:
	SetHudInputCapture('main_hud', playerSlot, true);
});

OnHudClicked_Register((playerSlot, hudName, buttonId) => {
	// handle click
});
```
## API reference

| Method | Description |
|---|---|
| `IsCsScriptReady()` | Whether `cs_script` is ready. |
| `OnCsScriptReady_Register(callback)` | Subscribes to `cs_script` becoming ready. Fires immediately if it already is. |
| `OnCsScriptReady_Unregister(callback)` | Unsubscribes. |
| `CreateCustomHud(name, layoutResource)` | Creates a hud. |
| `RemoveCustomHud(name)` | Removes a hud. |
| `HideCustomHudFromOtherPlayers(name, playerSlot)` | Hides the hud from everyone except `playerSlot`. |
| `SetHudHasClass(name, panelId, className, hasClass)` | Adds/removes a CSS class on a panel, for all players. |
| `SetHudHasClassForPlayer(name, playerSlot, panelId, className, hasClass)` | Same, but for one player only. |
| `SetHudDialogVariable(name, panelId, variableName, value)` | Sets a panel variable, for all players. |
| `SetHudDialogVariableForPlayer(name, playerSlot, panelId, variableName, value)` | Same, but for one player only. |
| `SetHudInputCapture(name, playerSlot, enabled)` | Turns a player's cursor/clicks on the hud on or off. |
| `IsHudInputCaptureEnabled(name, playerSlot)` | Whether a player's input is currently captured. |
| `ResetHud(name)` | Resets the hud to its original state for all players. |
| `ResetHudForPlayer(name, playerSlot)` | Resets one player's overrides to the original state. |
| `OnHudClicked_Register(callback)` | Subscribes to button clicks on a hud. |
| `OnHudClicked_Unregister(callback)` | Unsubscribes from clicks. |

## Important

- A hud doesn't survive a map change. Call `CreateCustomHud` again on the new map.
- Valve's official `CustomHudLayout` documentation is in [`pps/point_script.d.ts`](pps/point_script.d.ts).

## License

[MIT](LICENSE).
