/**
 * cg-workspace-colors, mitad Host.
 *
 * A proposito no registra nada. Lo que agrega este bundle es preferencia de
 * interfaz (color por workspace y visibilidad de los indicadores) y el harness
 * ya tiene su lugar para eso: `localStorage` del renderer, con la misma
 * convencion que usa el shipped (`dsh.<area>.<cosa>.vN`). El color no viaja al
 * Host porque no cambia ninguna operacion de negocio: solo como se ve la fila.
 *
 * La mitad navegador pinta el sidebar y agrega la pagina de ajustes; ver
 * `lib/client.js`.
 *
 * @module cg-workspace-colors
 */

/** Identidad estable del Loader. */
export const name = 'cg-workspace-colors';

/** Mitad Host inerte; la fila del bundle solo necesita cargar. */
export function apply() {}
