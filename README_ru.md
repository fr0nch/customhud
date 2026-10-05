[![English](https://img.shields.io/badge/English-%F0%9F%87%AC%F0%9F%87%A7-blue?style=for-the-badge)](README.md)

# CS2 Custom Hud API

[English](README.md) | **Русский**

Плагин [Plugify](https://github.com/untrustedmodders/plugify), который даёт другим плагинам (на любом языке: Go, C++, Python, JS) управлять кастомным HUD'ом (`custom_hud_layout`) в CS2.

## Для чего это нужно

Худ (`custom_hud_layout`) может создать только сама карта или `cs_script` - обычный серверный плагин напрямую так не может. А управлять уже созданным худом (классы CSS, переменные, клики) можно только изнутри `cs_script`.
Этот плагин берёт это на себя: создаёт худ через `s2sdk`, сам следит за `cs_script`, и отдаёт простые функции (`CreateCustomHud`, `SetHudHasClass` и т.д.), которыми может пользоваться любой другой плагин, без своего `cs_script`-файла.

## Требования

- Плагин [Source 2 SDK](https://github.com/untrustedmodders/plugify) версии 2.18.0 или новее
- Языковой модуль [V8 для JavaScript](https://github.com/untrustedmodders/plugify)

## Использование

```js
// Из любого плагина на Plugify. Всё ниже требует cs_script, поэтому всё
// внутри OnCsScriptReady_Register. Если он уже готов, сработает сразу.
OnCsScriptReady_Register(() => {
	const hud = CreateCustomHud('main_hud', 'panorama/layout/custom_game/main_hud.vxml');

	// Задать класс для всех игроков:
	SetHudHasClass(hud, 'dialog', 'Dismissed', false);

	// Значение для одного игрока перекрывает общее:
	SetHudHasClassForPlayer(hud, playerSlot, 'dialog', 'Dismissed', true);

	// Дать игроку кликать по кнопкам худа:
	SetHudInputCapture(hud, playerSlot, true);
});

OnHudClicked_Register((playerSlot, hud, buttonId) => {
	// обработка клика
});
```
## Справочник API

| Метод | Описание |
|---|---|
| `IsCsScriptReady()` | Готов ли `cs_script`. |
| `OnCsScriptReady_Register(callback)` | Подписка на готовность `cs_script`. Если он уже готов, сработает сразу при регистрации. |
| `OnCsScriptReady_Unregister(callback)` | Отписка. |
| `CreateCustomHud(name, layoutResource)` | Создаёт худ и возвращает его хэндл (`-1` при ошибке). Все остальные методы принимают этот хэндл. Он действует, пока худ не удалён и карта не сменилась. Имя не обязано быть уникальным. |
| `FindCustomHud(name)` | Возвращает хэндл первого худа с таким именем, например поставленного на карту (`-1`, если не найден). |
| `RemoveCustomHud(hud)` | Удаляет худ. |
| `HideCustomHudFromOtherPlayers(hud, playerSlot)` | Прячет худ от всех, кроме `playerSlot`. |
| `SetHudHasClass(hud, panelId, className, hasClass)` | Добавляет/убирает CSS-класс панели, у всех игроков. |
| `ResetHudHasClass(hud, panelId, className)` | Возвращает класс панели к исходному значению из макета, у всех игроков. |
| `SetHudHasClassForPlayer(hud, playerSlot, panelId, className, hasClass)` | То же самое, но только для одного игрока. |
| `ResetHudHasClassForPlayer(hud, playerSlot, panelId, className)` | Убирает значение одного игрока, чтобы снова действовало общее. |
| `BHasClass(hud, playerSlot, panelId, className)` | Есть ли у панели класс для игрока. Берётся значение игрока, если оно задано, иначе общее (`-1` проверяет только общее). Классы из `.xml` макета не учитываются. |
| `ToggleClass(hud, playerSlot, panelId, className)` | Переключает класс на основе `BHasClass`. `-1` переключает общее значение. |
| `SetHudDialogVariable(hud, panelId, variableName, value)` | Задаёт переменную панели, у всех игроков. |
| `SetHudDialogVariableForPlayer(hud, playerSlot, panelId, variableName, value)` | То же самое, но только для одного игрока. |
| `ResetHudDialogVariableForPlayer(hud, playerSlot, panelId, variableName)` | Убирает значение переменной у одного игрока, чтобы снова действовало общее. |
| `SetHudInputCapture(hud, playerSlot, enabled)` | Включает/выключает курсор и клики для игрока. |
| `IsHudInputCaptureEnabled(hud, playerSlot)` | Захвачен ли сейчас ввод игрока. |
| `ResetHud(hud)` | Сбрасывает худ в исходное состояние для всех игроков. |
| `ResetHudForPlayer(hud, playerSlot)` | Сбрасывает переопределения одного игрока. |
| `OnHudClicked_Register(callback)` | Подписка на клики по кнопкам худа. |
| `OnHudClicked_Unregister(callback)` | Отписка от кликов. |

## Важно

- Худ не переживает смену карты на новой карте нужно вызвать `CreateCustomHud` заново.
- Официальная документация Valve по `CustomHudLayout` в [`pps/point_script.d.ts`](pps/point_script.d.ts).

## Лицензия

[MIT](LICENSE).
