# cg-workspace-colors

Color por workspace e indicadores de sesiones en el sidebar de DSH.

Un workspace se puede pintar con un color propio, y su fila muestra cuantas
sesiones de adentro estan **activas**, **esperando respuesta** (approval, plan o
pregunta) o **sin leer**. El indicador vive en la fila del workspace, asi que se
ve desde afuera: no hace falta abrir el grupo ni entrar a la sesion.

## Como se usa

**Ajustes > Workspaces.** Una fila por workspace, con la paleta corta, el
selector de color nativo y "Sin color". Arriba hay dos interruptores:

| Interruptor | Que hace |
|---|---|
| Colorear la fila | Barra de acento, icono de carpeta y fondo tenue con el color elegido |
| Mostrar indicadores | El texto con las cuentas al final de la fila del workspace |

Los colores se guardan en `localStorage['dsh.workspaceColors.v1']` del navegador
del harness, con la misma convencion que usa el propio harness para preferencias
de interfaz (`dsh.<area>.<cosa>.vN`). Sobreviven recargas y actualizaciones;
desinstalar el bundle no los borra.

## Que dice el indicador

| Texto | Significa |
|---|---|
| `2 pendientes` | Dos sesiones esperan que las atiendas (amber) |
| `3 activas` | Tres sesiones estan corriendo ahora (azul) |
| `2 pend. · 1 act.` | Las dos cosas a la vez; abreviado porque la fila es angosta |
| `1 nueva` | Una sesion termino y no la leiste (solo si no hay nada mas urgente) |

Los estados salen de `useSessionStatus` del harness: `running`,
`pendingInteraction.kind` (`approval` / `plan-review` / `question`) y
`completionUnread`. Las sesiones archivadas no cuentan.

Esto llena un hueco que el harness deja a proposito: su README dice que las
interacciones pendientes **no** se agregan al grupo colapsado, o sea que una
sesion esperando dentro de un workspace cerrado no avisa en la cabecera.

## Como pinta sin reemplazar el sidebar

`sidebar.workspaces` es un slot `single` cuyo ocupante shipped es el browser
completo (busqueda, grupos, drag, dialogos). Reemplazarlo seria reimplementarlo,
y con el riesgo de quedarse atras en cada version. Este bundle **no** lo toca:

- La mitad cliente se registra en `shell.overlay` (un slot `list` aditivo) con un
  componente que solo emite un `<style>` propio.
- Ese CSS apunta a `[data-row-key="workspace:<id>"]`, la marca que ui-workspace
  pone en cada fila de workspace, y usa `::after` para el texto del indicador.
- Los datos llegan por las props estandar del slot (`useWorkspaces`,
  `useSessionStatus`), que el harness entrega a cualquier ocupante bajo
  `sidebar`/`root`.

**Riesgo conocido:** `data-row-key` es detalle de implementacion de
ui-workspace, no un contrato documentado. Si una version futura lo cambia, el
plugin deja de pintar y de mostrar cuentas, pero no rompe el sidebar ni la
conversacion; se arregla actualizando el selector.

## Verificacion

Una compuerta, sin mirar imagenes:

```powershell
node _dsh-bundles\cg-workspace-colors\test\compuerta.mjs
```

Carga el `lib/client.js` real con un loader y un React minimos, le pide al
componente de la hoja de estilos el CSS que produciria, lo aplica a un DOM con
la misma estructura que genera ui-workspace (`wnFoaW_projectRow`,
`data-row-key`) y comprueba con Chrome que: la barra de acento y el icono toman
el color, el fondo usa `color-mix`, el badge sale compacto y en tono amber, el
titulo trunca en vez de desbordar, y una fila sin color no recibe nada.

## Instalar / quitar

```powershell
plugin_manager action=install_bundle target=C:\Users\ginte\Documents\deepseek-harness\default-workspace\_dsh-bundles\cg-workspace-colors
plugin_manager action=remove_bundle target=cg-workspace-colors
```

Es un paquete `link:`: editar `lib/client.js` y volver a instalar alcanza para
la proxima carga; si el navegador ya tenia el modulo viejo, reiniciar DSH.

## Publicacion

| Donde | Identificador |
|---|---|
| npm publico | `cg-workspace-colors` — `https://www.npmjs.com/package/cg-workspace-colors` |
| GitHub | `https://github.com/DonGeeo87/cg-workspace-colors` (publico, MIT) |
| Registro npm de Forgejo (AIO) | `http://192.168.1.50:3102/api/packages/giorgio/npm/` |
| Fuente interna | `http://192.168.1.50:3102/giorgio/cg-workspace-colors` (privado) |

Se publica en los tres lados con la misma version: GitHub es la cara publica, npmjs
la distribucion y el registro de Forgejo queda como copia interna.

```powershell
# GitHub
git push github main --tags
# npm publico
npm publish --access public
# registro interno de Forgejo
npm publish --registry http://192.168.1.50:3102/api/packages/giorgio/npm/ --//192.168.1.50:3102/api/packages/giorgio/npm/:_authToken=$env:FORGEJO_TOKEN
```

En otra maquina se instala desde cualquiera de los dos registros:

```powershell
plugin_manager action=install_bundle target=cg-workspace-colors
plugin_manager action=install_bundle target=cg-workspace-colors registry=http://192.168.1.50:3102/api/packages/giorgio/npm/
```

Publicar una version nueva (la compuerta tiene que pasar antes):

```powershell
node test\compuerta.mjs
# subir "version" en package.json y comitear
git tag -a vX.Y.Z -m "cg-workspace-colors X.Y.Z"
git push origin main --tags
git push github main --tags
npm publish --access public
```

Ningun token se guarda en el repo: en la maquina estan en `gh` (keyring) y en el
`.npmrc` del usuario, y para Forgejo van por variable de entorno (`FORGEJO_TOKEN`).

## Reparto de responsabilidades

| Mitad | Archivo | Que hace |
|---|---|---|
| Host | `lib/index.js` | Nada: no hay negocio detras de un color |
| Cliente | `lib/client.js` | Hoja de estilos + pagina de Ajustes |
| Prueba | `test/banco.mjs`, `test/compuerta.mjs` | Banco estatico y compuerta |
