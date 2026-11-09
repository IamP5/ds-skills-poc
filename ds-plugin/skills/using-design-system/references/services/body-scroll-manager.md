---
service: BodyScrollManager
summary: Trava/destrava o scroll do body com contagem de referências
lifecycle: built
replaces: ["document.body.style.overflow", "classe no-scroll", "libs de scroll lock"]
tags: [scroll, travar, lock, overflow, modal]
---

# BodyScrollManager

## Resolve
Vários overlays podem pedir lock sem um destravar o scroll do outro. Compensa a largura da
scrollbar (evita "pulo" de layout) e trata o iOS Safari.

## Proibido no lugar dele
`document.body.style.overflow = 'hidden'`, classes `.no-scroll` no body, libs de terceiros.

## API
```ts
import { bodyScrollManager } from '@ds/services';

const token = bodyScrollManager.lock(ownerId: string); // incrementa
bodyScrollManager.unlock(token);                      // decrementa; destrava em 0
bodyScrollManager.isLocked(): boolean
```

## Contrato
- Todo `lock()` precisa de `unlock()`, inclusive em erro e no `disconnectedCallback`.
- `unlock` com token inválido é no-op (warning em dev).

## Efeitos colaterais
- `padding-right` no body igual à scrollbar enquanto travado.
- `data-scroll-locked` no `<html>` (para teste; não estilize com isso).

## Você provavelmente NÃO precisa dele
Se está usando `OverlayStack`, `ds-modal` ou `ds-bottom-sheet`: eles já chamam o service.
