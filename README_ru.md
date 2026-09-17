[![English](https://img.shields.io/badge/English-%F0%9F%87%AC%F0%9F%87%A7-blue?style=for-the-badge)](README.md)

# CS2 Custom Hud API

[English](README.md) | **Русский**

Плагин [Plugify](https://github.com/untrustedmodders/plugify), который даёт другим плагинам (на любом языке: Go, C++, Python, JS) управлять кастомным HUD'ом (`custom_hud_layout`) в CS2.

## Для чего это нужно

Худ (`custom_hud_layout`) может создать только сама карта или `cs_script` - обычный серверный плагин напрямую так не может. А управлять уже созданным худом (классы CSS, переменные, клики) можно только изнутри `cs_script`.
Этот плагин берёт это на себя: создаёт худ через `s2sdk`, сам следит за `cs_script`, и отдаёт простые функции (`CreateCustomHud`, `SetHudHasClass` и т.д.), которыми может пользоваться любой другой плагин, без своего `cs_script`-файла.

## Требования

- Плагин [Source 2 SDK](https://github.com/untrustedmodders/plugify)
- Языковой модуль [V8 для JavaScript](https://github.com/untrustedmodders/plugify)

## Использование

```js
// Из любого плагина на Plugify. Всё ниже требует cs_script, поэтому всё
// внутри OnCsScriptReady_Register — если он уже готов, сработает сразу.
OnCsScriptReady_Register(() => {
	CreateCustomHud('main_hud', 'panorama/layout/custom_game/main_hud.vxml');

	// Панель на клиенте появляется не сразу - вызовите хотя бы один
	// Set*-метод, прежде чем ждать, что игрок её увидит:
	SetHudHasClass('main_hud', 'dialog', 'Dismissed', false);

	// Значение для одного игрока перекрывает общее:
	SetHudHasClassForPlayer('main_hud', playerSlot, 'dialog', 'Dismissed', true);

	// Дать игроку кликать по кнопкам худа:
	SetHudInputCapture('main_hud', playerSlot, true);
});

OnHudClicked_Register((playerSlot, hudName, buttonId) => {
	// обработка клика
});
```
## Справочник API

| Метод | Описание |
|---|---|
| `IsCsScriptReady()` | Готов ли `cs_script`. |
| `OnCsScriptReady_Register(callback)` | Подписка на готовность `cs_script`. Если он уже готов — сработает сразу при регистрации. |
| `OnCsScriptReady_Unregister(callback)` | Отписка. |
| `CreateCustomHud(name, layoutResource)` | Создаёт худ. |
| `RemoveCustomHud(name)` | Удаляет худ. |
| `HideCustomHudFromOtherPlayers(name, playerSlot)` | Прячет худ от всех, кроме `playerSlot`. |
| `SetHudHasClass(name, panelId, className, hasClass)` | Добавляет/убирает CSS-класс панели, у всех игроков. |
| `SetHudHasClassForPlayer(name, playerSlot, panelId, className, hasClass)` | То же самое, но только для одного игрока. |
| `SetHudDialogVariable(name, panelId, variableName, value)` | Задаёт переменную панели, у всех игроков. |
| `SetHudDialogVariableForPlayer(name, playerSlot, panelId, variableName, value)` | То же самое, но только для одного игрока. |
| `SetHudInputCapture(name, playerSlot, enabled)` | Включает/выключает курсор и клики для игрока. |
| `IsHudInputCaptureEnabled(name, playerSlot)` | Захвачен ли сейчас ввод игрока. |
| `OnHudClicked_Register(callback)` | Подписка на клики по кнопкам худа. |
| `OnHudClicked_Unregister(callback)` | Отписка от кликов. |

## Важно

- Худ не переживает смену карты на новой карте нужно вызвать `CreateCustomHud` заново.
- Официальная документация Valve по `CustomHudLayout` в [`pps/point_script.d.ts`](pps/point_script.d.ts).

## Лицензия

[MIT](LICENSE).
