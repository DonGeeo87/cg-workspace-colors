/**
 * cg-workspace-colors, mitad navegador.
 *
 * Dos cosas, en dos lugares distintos:
 *
 *   1. En el sidebar: cada workspace se pinta con el color que el usuario le
 *      asigne y muestra un indicador con cuantas sesiones tiene activas,
 *      esperando respuesta o sin leer. El indicador aparece en la fila del
 *      workspace, o sea que se ve desde afuera y tambien con el grupo cerrado.
 *
 *   2. En Ajustes: una pagina "Workspaces" con una fila por workspace para
 *      elegir color (paleta corta o selector nativo) y apagar los indicadores.
 *
 * Como se pinta sin romper nada: `sidebar.workspaces` es un slot `single` y su
 * ocupante shipped es el browser completo (busqueda, grupos, drag, dialogos).
 * Reemplazarlo seria reimplementarlo, asi que este bundle NO lo toca: inyecta
 * una hoja de estilos propia que apunta a `[data-row-key="workspace:<id>"]` y
 * a `[data-row-key="workspace:<id>"]::after`, que es como ui-workspace marca
 * cada fila. Todo el color y todo el texto del indicador salen de esa hoja, que
 * se regenera cuando cambian las sesiones. Si esa marca cambiara en una version
 * futura del harness el plugin deja de pintar, sin romper el sidebar.
 *
 * Los datos no se inventan: el ocupante de un slot bajo `sidebar`/`root` recibe
 * como props los hooks del harness (`useWorkspaces`, `useSessionStatus`), y de
 * ahi salen los ids de sesion por workspace y su estado
 * (`running`, `pendingInteraction.kind`, `completionUnread`).
 *
 * Este archivo se sirve crudo como script clasico: todo el trabajo, incluido el
 * runtime de JSX alternativo (createElement), vive dentro de la factory.
 */
window.__ModuleLoader__.load({
	id: 'cg-workspace-colors',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const react = require('react');
		const h = react.createElement;

		/** Slot de overlay: siempre montado, no dibuja nada visible. */
		const OVERLAY_ID = 'cg-workspace-colors:css';

		/** Pagina de ajustes. */
		const SECTION_ID = 'cg-workspace-colors';

		/** Preferencias de interfaz; misma convencion que el shipped (`dsh.*.vN`). */
		const PREFS_KEY = 'dsh.workspaceColors.v1';

		/** Paleta corta; el selector nativo cubre cualquier otro color. */
		const PRESETS = [
			{ id: 'azul', hex: '#3b82f6' },
			{ id: 'cian', hex: '#06b6d4' },
			{ id: 'verde', hex: '#10b981' },
			{ id: 'lima', hex: '#84cc16' },
			{ id: 'ambar', hex: '#f59e0b' },
			{ id: 'naranja', hex: '#f97316' },
			{ id: 'rojo', hex: '#ef4444' },
			{ id: 'rosa', hex: '#ec4899' },
			{ id: 'violeta', hex: '#8b5cf6' },
			{ id: 'indigo', hex: '#6366f1' },
			{ id: 'turquesa', hex: '#14b8a6' },
			{ id: 'gris', hex: '#64748b' }
		];

		/** Estados que cuentan como "esperando respuesta del usuario". */
		const PENDING_KINDS = ['approval', 'plan-review', 'question'];

		/** Fallbacks de tokens del tema, por si alguno no existe en este tema. */
		const TONE_PENDING = 'var(--dsw-alias-state-warning-primary,#d97706)';
		const TONE_RUNNING = 'var(--dsw-alias-state-business-primary,#2f7cf6)';
		const TONE_MUTED = 'var(--dsw-alias-label-tertiary,#8a9199)';
		const BORDER = 'var(--dsw-alias-border-l4,#2c2f33)';
		const LABEL_PRIMARY = 'var(--dsw-alias-label-primary,inherit)';
		const LABEL_TERTIARY = 'var(--dsw-alias-label-tertiary,#8a9199)';

		// ------------------------------------------------------------------
		// Preferencias
		// ------------------------------------------------------------------

		/** Preferencias por defecto. */
		function defaultPrefs() {
			return { colors: {}, tintRow: true, badges: true };
		}

		/** Un color se acepta solo como hex de seis digitos. */
		function isHex(value) {
			return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
		}

		/**
		 * Normaliza lo leido de localStorage: descarta basura en vez de confiar.
		 * @param {unknown} value - valor parseado.
		 * @returns {{colors: Record<string, string>, tintRow: boolean, badges: boolean}} preferencias sanas.
		 */
		function normalizePrefs(value) {
			const prefs = defaultPrefs();
			if (value === null || typeof value !== 'object') return prefs;
			const source = value;
			if (source.colors !== null && typeof source.colors === 'object') {
				for (const [id, color] of Object.entries(source.colors)) {
					if (typeof id === 'string' && id !== '' && isHex(color)) prefs.colors[id] = color;
				}
			}
			if (typeof source.tintRow === 'boolean') prefs.tintRow = source.tintRow;
			if (typeof source.badges === 'boolean') prefs.badges = source.badges;
			return prefs;
		}

		/** Copia en memoria; se descarta al cambiar desde otra ventana. */
		let cachedPrefs = null;

		/** Suscriptores de la pagina (ajustes y hoja de estilos). */
		const prefsListeners = new Set();

		/**
		 * Lee las preferencias, con cache por carga de pagina.
		 * @returns {{colors: Record<string, string>, tintRow: boolean, badges: boolean}} preferencias.
		 */
		function readPrefs() {
			if (cachedPrefs !== null) return cachedPrefs;
			try {
				const raw = window.localStorage.getItem(PREFS_KEY);
				cachedPrefs = normalizePrefs(raw === null ? null : JSON.parse(raw));
			} catch {
				// localStorage bloqueado o JSON roto: arrancar con defaults, nunca romper.
				cachedPrefs = defaultPrefs();
			}
			return cachedPrefs;
		}

		/**
		 * Mezcla un cambio, lo guarda y avisa a los suscriptores.
		 * @param {object} patch - campos a cambiar.
		 * @returns {void}
		 */
		function writePrefs(patch) {
			cachedPrefs = { ...readPrefs(), ...patch };
			try {
				window.localStorage.setItem(PREFS_KEY, JSON.stringify(cachedPrefs));
			} catch {
				// Sin persistencia el cambio vale para esta pagina; no se avisa como error.
			}
			for (const listener of prefsListeners) {
				try {
					listener();
				} catch {
					// Un suscriptor roto no puede tumbar a los demas.
				}
			}
		}

		/**
		 * Hook de lectura de preferencias; re-renderiza al cambiar.
		 * @returns {{colors: Record<string, string>, tintRow: boolean, badges: boolean}} preferencias.
		 */
		function usePrefs() {
			const [, bump] = react.useState(0);
			react.useEffect(() => {
				const listener = () => bump((n) => n + 1);
				prefsListeners.add(listener);
				const onStorage = (event) => {
					if (event.key !== PREFS_KEY && event.key !== null) return;
					cachedPrefs = null;
					bump((n) => n + 1);
				};
				window.addEventListener('storage', onStorage);
				return () => {
					prefsListeners.delete(listener);
					window.removeEventListener('storage', onStorage);
				};
			}, []);
			return readPrefs();
		}

		// ------------------------------------------------------------------
		// Estado de las sesiones por workspace
		// ------------------------------------------------------------------

		/**
		 * Cuenta, para un workspace, que sesiones suyas estan en cada estado.
		 * @param {object} workspace - item del snapshot (`sessionIds`).
		 * @param {Map<string, object>|undefined} statuses - `useSessionStatus`.
		 * @param {ReadonlySet<string>} archived - ids archivados.
		 * @returns {{total: number, running: number, pending: number, unread: number}} cuentas.
		 */
		function aggregate(workspace, statuses, archived) {
			let total = 0;
			let running = 0;
			let pending = 0;
			let unread = 0;
			const ids = Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : [];
			for (const id of ids) {
				if (archived.has(id)) continue;
				total += 1;
				const status = statuses === undefined || statuses === null ? undefined : statuses.get(id);
				if (status === undefined || status === null) continue;
				if (status.running === true) running += 1;
				const kind = status.pendingInteraction?.kind;
				if (PENDING_KINDS.includes(kind)) pending += 1;
				if (status.completionUnread === true) unread += 1;
			}
			return { total, running, pending, unread };
		}

		/**
		 * Texto corto del indicador. Prioriza lo que espera al usuario; una
		 * finalizacion sin leer solo se muestra cuando no hay nada mas. Con dos
		 * estados a la vez se abrevia, porque la fila del sidebar es angosta.
		 * @param {{running: number, pending: number, unread: number}} counts - cuentas.
		 * @returns {string} texto o cadena vacia si no hay nada que mostrar.
		 */
		function badgeText(counts) {
			const parts = [];
			const dual = counts.pending > 0 && counts.running > 0;
			if (counts.pending > 0) {
				parts.push(
					dual
						? `${counts.pending} pend.`
						: counts.pending === 1
							? '1 pendiente'
							: `${counts.pending} pendientes`
				);
			}
			if (counts.running > 0) {
				parts.push(
					dual
						? `${counts.running} act.`
						: counts.running === 1
							? '1 activa'
							: `${counts.running} activas`
				);
			}
			if (parts.length === 0 && counts.unread > 0) parts.push(counts.unread === 1 ? '1 nueva' : `${counts.unread} nuevas`);
			return parts.join(' · ');
		}

		/**
		 * Color del indicador segun lo mas urgente que tenga adentro.
		 * @param {{running: number, pending: number, unread: number}} counts - cuentas.
		 * @returns {string} valor CSS del color.
		 */
		function badgeTone(counts) {
			if (counts.pending > 0) return TONE_PENDING;
			if (counts.running > 0) return TONE_RUNNING;
			return TONE_MUTED;
		}

		/**
		 * Escapa un valor para meterlo en un selector de atributo entre comillas.
		 * @param {string} value - id del workspace.
		 * @returns {string} valor seguro.
		 */
		function escapeAttr(value) {
			return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		}

		/**
		 * Escapa un texto para meterlo como contenido de una cadena CSS.
		 * @param {string} value - texto del indicador.
		 * @returns {string} texto seguro.
		 */
		function escapeContent(value) {
			return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		}

		// ------------------------------------------------------------------
		// Hoja de estilos
		// ------------------------------------------------------------------

		/**
		 * Arma el CSS completo: base del indicador y una regla por workspace con
		 * color o con cuentas. Se regenera entero en cada cambio, que es mas
		 * barato y mas predecible que ir parcheando reglas.
		 * @param {readonly object[]} items - workspaces del snapshot.
		 * @param {Map<string, object>|undefined} statuses - estados por sesion.
		 * @param {ReadonlySet<string>} archived - ids archivados.
		 * @param {{colors: Record<string, string>, tintRow: boolean, badges: boolean}} prefs - preferencias.
		 * @returns {string} hoja de estilos.
		 */
		function buildCss(items, statuses, archived, prefs) {
			const rules = [];
			// Base: el pseudo-elemento existe siempre pero solo dibuja cuando una
			// regla por workspace le da contenido y color.
			rules.push(
				'[data-row-key^="workspace:"]::after{' +
					'content:var(--cg-ws-badge,"");' +
					'margin-inline-start:auto;' +
					'padding-inline-start:6px;' +
					'flex:none;' +
					// Tope duro: en un sidebar angosto el indicador cede antes que
					// empujar el titulo del workspace fuera de la fila.
					'max-width:55%;' +
					'overflow:hidden;' +
					'text-overflow:ellipsis;' +
					'font-size:10px;' +
					'font-variant-numeric:tabular-nums;' +
					'line-height:16px;' +
					'white-space:nowrap;' +
					'color:var(--cg-ws-badge-color,' +
					TONE_MUTED +
					');' +
					'pointer-events:none' +
					'}'
			);
			for (const item of items) {
				const workspaceId = item?.workspaceId;
				// El bucket "Ungrouped" no tiene id: no se pinta ni cuenta.
				if (typeof workspaceId !== 'string' || workspaceId === '') continue;
				const selector = '[data-row-key="workspace:' + escapeAttr(workspaceId) + '"]';
				const color = prefs.colors[workspaceId];
				if (isHex(color)) {
					rules.push(selector + '{--cg-ws-color:' + color + ';box-shadow:inset 2px 0 0 0 ' + color + '}');
					rules.push(selector + ' [class*="_folder"]{color:' + color + '}');
					if (prefs.tintRow) {
						rules.push(selector + '{background:color-mix(in srgb, ' + color + ' 10%, transparent)}');
						rules.push(
							selector +
								':hover{background:color-mix(in srgb, ' +
								color +
								' 18%, var(--dsw-alias-interactive-bg-hover,#1b1d20))}'
						);
					}
				}
				if (!prefs.badges) continue;
				const counts = aggregate(item, statuses, archived);
				const text = badgeText(counts);
				if (text === '') continue;
				rules.push(
					selector +
						'{--cg-ws-badge:"' +
						escapeContent(text) +
						'";--cg-ws-badge-color:' +
						badgeTone(counts) +
						'}'
				);
			}
			return rules.join('\n');
		}

		/**
		 * Lee el snapshot de workspaces de las props estandar del slot.
		 * @param {object} props - props del ocupante.
		 * @returns {{items: readonly object[], archivedSessionIds: readonly string[]}} snapshot.
		 */
		function workspaceSnapshot(props) {
			if (typeof props.useWorkspaces !== 'function') return { items: [], archivedSessionIds: [] };
			const snapshot = props.useWorkspaces((state) => state);
			return {
				items: Array.isArray(snapshot?.items) ? snapshot.items : [],
				archivedSessionIds: Array.isArray(snapshot?.archivedSessionIds) ? snapshot.archivedSessionIds : []
			};
		}

		/**
		 * Lee el mapa de estados de sesion de las props estandar del slot.
		 * @param {object} props - props del ocupante.
		 * @returns {Map<string, object>|undefined} estados por sesion.
		 */
		function sessionStatuses(props) {
			if (typeof props.useSessionStatus !== 'function') return undefined;
			return props.useSessionStatus((value) => value);
		}

		/**
		 * Ocupante de `shell.overlay`: no dibuja nada visible, solo mantiene la
		 * hoja de estilos al dia mientras la pagina este abierta.
		 * @param {object} props - props del slot.
		 * @returns {object} elemento `<style>`.
		 */
		function StyleSheet(props) {
			const prefs = usePrefs();
			const snapshot = workspaceSnapshot(props);
			const statuses = sessionStatuses(props);
			const archived = react.useMemo(
				() => new Set(snapshot.archivedSessionIds),
				[snapshot.archivedSessionIds]
			);
			const css = react.useMemo(
				() => buildCss(snapshot.items, statuses, archived, prefs),
				[snapshot.items, statuses, archived, prefs]
			);
			return h('style', { 'data-cg-workspace-colors': '', children: css });
		}

		// ------------------------------------------------------------------
		// Pagina de ajustes
		// ------------------------------------------------------------------

		/**
		 * Boton de color de la paleta.
		 * @param {object} p - props.
		 * @returns {object} boton.
		 */
		function Swatch(p) {
			const selected = p.current === p.hex;
			return h('button', {
				type: 'button',
				title: p.label,
				'aria-label': p.label,
				'aria-pressed': selected,
				onClick: () => p.onPick(p.hex),
				style: {
					width: '18px',
					height: '18px',
					padding: '0',
					borderRadius: '50%',
					border: 'none',
					cursor: 'pointer',
					background: p.hex,
					boxShadow: selected ? '0 0 0 2px ' + LABEL_PRIMARY : 'inset 0 0 0 1px rgba(0,0,0,.25)'
				}
			});
		}

		/**
		 * Fila de un workspace: muestra, cuentas y controles de color.
		 * @param {object} p - props.
		 * @returns {object} fila.
		 */
		function WorkspaceRow(p) {
			const current = isHex(p.color) ? p.color : null;
			const counts = p.counts;
			const countsText =
				counts.total === 0
					? 'sin sesiones'
					: counts.total === 1
						? '1 sesion'
						: `${counts.total} sesiones`;
			const detail = [countsText];
			if (counts.running > 0) detail.push(counts.running === 1 ? '1 activa' : `${counts.running} activas`);
			if (counts.pending > 0) detail.push(counts.pending === 1 ? '1 pendiente' : `${counts.pending} pendientes`);
			if (counts.unread > 0) detail.push(counts.unread === 1 ? '1 sin leer' : `${counts.unread} sin leer`);
			return h(
				'div',
				{
					style: {
						display: 'flex',
						flexWrap: 'wrap',
						alignItems: 'center',
						gap: '10px',
						padding: '10px 12px',
						border: '1px solid ' + BORDER,
						borderRadius: '8px'
					}
				},
				[
					h('span', {
						key: 'dot',
						style: {
							width: '10px',
							height: '10px',
							flex: 'none',
							borderRadius: '50%',
							background: current === null ? 'transparent' : current,
							boxShadow: current === null ? 'inset 0 0 0 1px ' + BORDER : 'none'
						}
					}),
					h('div', { key: 'text', style: { flex: '1 1 180px', minWidth: '0' } }, [
						h(
							'div',
							{
								key: 'name',
								style: {
									fontSize: '13px',
									color: LABEL_PRIMARY,
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis'
								}
							},
							p.title
						),
						h(
							'div',
							{
								key: 'meta',
								style: {
									fontSize: '11px',
									color: LABEL_TERTIARY,
									whiteSpace: 'nowrap',
									overflow: 'hidden',
									textOverflow: 'ellipsis'
								}
							},
							detail.join(' · ')
						)
					]),
					h(
						'div',
						{ key: 'controls', style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
						[
							...PRESETS.map((preset) =>
								h(Swatch, {
									key: preset.id,
									hex: preset.hex,
									label: preset.id,
									current,
									onPick: (hex) => p.onSet(hex)
								})
							),
							h(
								'input',
								{
									key: 'custom',
									type: 'color',
									title: 'Otro color',
									'aria-label': 'Otro color',
									value: current === null ? '#3b82f6' : current,
									onChange: (event) => p.onSet(event.target.value),
									style: {
										width: '22px',
										height: '22px',
										padding: '0',
										border: 'none',
										background: 'transparent',
										cursor: 'pointer'
									}
								}
							),
							h(
								'button',
								{
									key: 'clear',
									type: 'button',
									onClick: () => p.onSet(null),
									disabled: current === null,
									style: {
										fontSize: '11px',
										padding: '2px 6px',
										borderRadius: '6px',
										border: '1px solid ' + BORDER,
										background: 'transparent',
										color: current === null ? LABEL_TERTIARY : LABEL_PRIMARY,
										cursor: current === null ? 'default' : 'pointer',
										opacity: current === null ? '0.5' : '1'
									}
								},
								'Sin color'
							)
						]
					)
				]
			);
		}

		/**
		 * Interruptor de una opcion booleana.
		 * @param {object} p - props.
		 * @returns {object} fila con checkbox.
		 */
		function Toggle(p) {
			return h('label', { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: LABEL_PRIMARY, cursor: 'pointer' } }, [
				h('input', { type: 'checkbox', checked: p.checked, onChange: (event) => p.onChange(event.target.checked) }),
				p.label
			]);
		}

		/**
		 * Ocupante de `settings.section`: la pagina de configuración.
		 * @param {object} props - props del slot.
		 * @returns {object} pagina.
		 */
		function SettingsPage(props) {
			const prefs = usePrefs();
			const snapshot = workspaceSnapshot(props);
			const statuses = sessionStatuses(props);
			const archived = react.useMemo(
				() => new Set(snapshot.archivedSessionIds),
				[snapshot.archivedSessionIds]
			);
			const workspaces = react.useMemo(
				() => snapshot.items.filter((item) => typeof item?.workspaceId === 'string' && item.workspaceId !== ''),
				[snapshot.items]
			);
			const setColor = (workspaceId, hex) => {
				const colors = { ...prefs.colors };
				if (hex === null) delete colors[workspaceId];
				else colors[workspaceId] = hex;
				writePrefs({ colors });
			};
			return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, [
				h('div', { key: 'head' }, [
					h('div', { key: 'title', style: { fontSize: '15px', fontWeight: '600', color: LABEL_PRIMARY } }, 'Colores de workspace'),
					h(
						'div',
						{ key: 'desc', style: { marginTop: '2px', fontSize: '12px', lineHeight: '18px', color: LABEL_TERTIARY } },
						'Pinta cada workspace en el sidebar y muestra cuantas sesiones tiene activas, esperando respuesta o sin leer. El indicador se ve desde afuera, tambien con el grupo cerrado.'
					)
				]),
				h('div', { key: 'toggles', style: { display: 'flex', flexWrap: 'wrap', gap: '16px' } }, [
					h(Toggle, {
						key: 'tint',
						label: 'Colorear la fila',
						checked: prefs.tintRow,
						onChange: (value) => writePrefs({ tintRow: value })
					}),
					h(Toggle, {
						key: 'badges',
						label: 'Mostrar indicadores',
						checked: prefs.badges,
						onChange: (value) => writePrefs({ badges: value })
					})
				]),
				workspaces.length === 0
					? h(
							'div',
							{ key: 'empty', style: { fontSize: '12px', color: LABEL_TERTIARY, padding: '8px 0' } },
							'Todavia no hay workspaces registrados.'
						)
					: h(
							'div',
							{ key: 'list', style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
							workspaces.map((item) =>
								h(WorkspaceRow, {
									key: item.workspaceId,
									title: typeof item.title === 'string' && item.title !== '' ? item.title : item.path,
									color: prefs.colors[item.workspaceId],
									counts: aggregate(item, statuses, archived),
									onSet: (hex) => setColor(item.workspaceId, hex)
								})
							)
						),
				h(
					'div',
					{ key: 'foot', style: { fontSize: '11px', lineHeight: '16px', color: LABEL_TERTIARY } },
					'Los colores se guardan en este equipo y sobreviven a las recargas. Desinstalar el bundle no borra la preferencia: se puede volver a instalar y queda como estaba.'
				)
			]);
		}

		// ------------------------------------------------------------------
		// Registro
		// ------------------------------------------------------------------

		/**
		 * Registra la hoja de estilos y la pagina de ajustes.
		 * @param {object} ctx - contexto raiz del cliente.
		 * @returns {void}
		 */
		function apply(ctx) {
			if (ctx === null || typeof ctx !== 'object' || ctx.slots === undefined) return;
			ctx.slots.inject('shell.overlay', () =>
				ctx.slots.register(
					{
						name: 'shell.overlay',
						id: OVERLAY_ID,
						order: 80
					},
					StyleSheet
				)
			);
			ctx.slots.inject('settings.section', () =>
				ctx.slots.register(
					{
						name: 'settings.section',
						id: SECTION_ID,
						order: 42,
						label: () => 'Workspaces'
					},
					SettingsPage
				)
			);
		}

		exports.inject = ['slots'];
		exports.apply = apply;
		return module.exports;
	}
});
