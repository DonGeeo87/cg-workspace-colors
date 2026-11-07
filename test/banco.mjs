// Genera un banco de pruebas estatico a partir del codigo REAL del plugin:
// carga lib/client.js con un loader falso, captura los componentes que `apply`
// registra y llama al componente de la hoja de estilos con props falsas para
// quedarse con el CSS que produciria el harness. Despues arma un HTML con el DOM
// que ui-workspace genera (misma clase y mismo data-row-key) para que Chrome
// resuelva el CSS de verdad.
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const BUNDLE = path.resolve(HERE, '..');
const OUT = path.join(HERE, '_banco');

const src = fs.readFileSync(path.join(BUNDLE, 'lib/client.js'), 'utf8');

// --- loader falso -------------------------------------------------------
let entry = null;
const fakeWindow = {
	__ModuleLoader__: {
		load: (value) => {
			entry = value;
		}
	},
	localStorage: {
		store: new Map(),
		getItem(key) {
			return this.store.has(key) ? this.store.get(key) : null;
		},
		setItem(key, value) {
			this.store.set(key, String(value));
		}
	},
	addEventListener() {},
	removeEventListener() {}
};
// El archivo se sirve como script clasico: `window` es el global.
new Function('window', src)(fakeWindow);
if (entry === null) throw new Error('el plugin no llamo a window.__ModuleLoader__.load');

// --- React minimo -------------------------------------------------------
const React = {
	createElement: (type, props, ...children) => {
		const merged = { ...(props ?? {}) };
		if (children.length === 1) merged.children = children[0];
		else if (children.length > 1) merged.children = children;
		return { type, props: merged };
	},
	useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
	useEffect: () => {},
	useMemo: (fn) => fn(),
	useRef: (value) => ({ current: value })
};
const requireStub = (name) => {
	if (name === 'react') return React;
	throw new Error('require inesperado: ' + name);
};

const mod = entry.factory(requireStub);
if (typeof mod.apply !== 'function') throw new Error('el plugin no exporta apply');

// --- ctx falso ---------------------------------------------------------
const components = new Map();
const ctx = {
	slots: {
		inject(name, callback) {
			callback();
		},
		register(options, component) {
			components.set(options.id, { options, component });
			return () => components.delete(options.id);
		}
	}
};
mod.apply(ctx);
for (const id of ['cg-workspace-colors:css', 'cg-workspace-colors']) {
	if (!components.has(id)) throw new Error('no se registro ' + id);
}

// --- datos falsos, con la forma medida en el harness --------------------
const A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const snapshot = {
	items: [
		{ workspaceId: A, title: 'Proyecto A', path: 'C:\\Proyectos\\a', createdAt: '2026-11-01T00:00:00Z', sessionIds: ['s1', 's2', 's3', 's4'] },
		{ workspaceId: B, title: 'Proyecto B', path: 'C:\\Proyectos\\b', createdAt: '2026-11-01T00:00:00Z', sessionIds: ['s5'] }
	],
	archivedSessionIds: [],
	pinnedSessionIds: []
};
const statuses = new Map([
	['s1', { running: true, pendingInteraction: undefined, completionUnread: false }],
	['s2', { running: false, pendingInteraction: { kind: 'approval' }, completionUnread: false }],
	['s3', { running: false, pendingInteraction: undefined, completionUnread: true }],
	['s4', { running: false, pendingInteraction: undefined, completionUnread: false }],
	['s5', { running: false, pendingInteraction: undefined, completionUnread: false }]
]);

const props = {
	useWorkspaces: (selector) => selector(snapshot),
	useSessionStatus: (selector) => selector(statuses)
};

// Preferencias: A con color verde y B sin color.
fakeWindow.localStorage.setItem(
	'dsh.workspaceColors.v1',
	JSON.stringify({ colors: { [A]: '#10b981' }, tintRow: true, badges: true })
);

const styleEntry = components.get('cg-workspace-colors:css');
const styleElement = styleEntry.component(props);
const css = styleElement.props.children;
if (typeof css !== 'string' || css.length === 0) throw new Error('la hoja de estilos salio vacia');

// --- pagina de ajustes: se renderiza sin lanzar y muestra las cuentas ----
// Renderer minimo: expande componentes de funcion para poder recorrer el arbol.
function expand(node) {
	if (node === null || typeof node !== 'object') return node;
	if (Array.isArray(node)) return node.map(expand);
	const { type, props } = node;
	if (typeof type === 'function') return expand(type({ ...(props ?? {}) }));
	const nextProps = { ...(props ?? {}) };
	const kids = nextProps.children;
	if (kids !== undefined) nextProps.children = Array.isArray(kids) ? kids.map(expand) : expand(kids);
	return { type, props: nextProps, name: type };
}
function collectText(node, out = []) {
	if (node === null || node === undefined) return out;
	if (typeof node === 'string' || typeof node === 'number') {
		out.push(String(node));
		return out;
	}
	if (Array.isArray(node)) {
		for (const child of node) collectText(child, out);
		return out;
	}
	if (typeof node === 'object') collectText(node.props?.children, out);
	return out;
}
function collectTypes(node, out = []) {
	if (node === null || typeof node !== 'object') return out;
	if (Array.isArray(node)) {
		for (const child of node) collectTypes(child, out);
		return out;
	}
	out.push(String(node.type));
	collectTypes(node.props?.children, out);
	return out;
}

const settingsEntry = components.get('cg-workspace-colors');
const settingsTree = expand(settingsEntry.component(props));
const texts = collectText(settingsTree).join(' | ');
const types = collectTypes(settingsTree);
const inputs = [];
(function walk(node) {
	if (node === null || typeof node !== 'object') return;
	if (Array.isArray(node)) return node.forEach(walk);
	if (node.type === 'input') inputs.push(node.props);
	if (node.type === 'button') inputs.push(node.props);
	walk(node.props?.children);
})(settingsTree);

const checks = {
	heading: texts.includes('Colores de workspace'),
	workspaceA: texts.includes('Proyecto A'),
	workspaceB: texts.includes('Proyecto B'),
	countsA: texts.includes('4 sesiones · 1 activa · 1 pendiente · 1 sin leer'),
	countsB: texts.includes('1 sesion'),
	swatches: inputs.filter((p) => p['aria-label'] !== undefined && p.type === 'button').length,
	colorPicker: inputs.filter((p) => p.type === 'color').length,
	toggles: inputs.filter((p) => p.type === 'checkbox').length,
	footer: texts.includes('Los colores se guardan en este equipo')
};
const broken = Object.entries(checks).filter(([, ok]) => ok === false).map(([name]) => name);
if (broken.length > 0) throw new Error('la pagina de ajustes no mostro: ' + broken.join(', '));
if (checks.swatches !== 24) throw new Error('esperaba 24 muestras de color (2 workspaces x 12), hay ' + checks.swatches);
if (checks.colorPicker !== 2) throw new Error('esperaba 2 selectores de color nativo, hay ' + checks.colorPicker);
if (types.filter((t) => t === 'div').length < 6) throw new Error('el arbol renderizado quedo vacio');
console.log('ajustes OK:', JSON.stringify(checks));


// --- banco -------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'generado.css'), css, 'utf8');

const row = (id, label) =>
	`<div class="wnFoaW_projectRow" data-row-key="workspace:${id}" role="treeitem" aria-expanded="true">` +
	`<span class="wnFoaW_slot wnFoaW_folder" id="folder-${id.slice(0, 1)}"><svg width="16" height="16"><rect width="16" height="16"/></svg></span>` +
	`<span class="wnFoaW_slot wnFoaW_chevron"></span>` +
	`<span class="wnFoaW_projectText"><span class="wnFoaW_title">${label}</span></span>` +
	`<span class="wnFoaW_rowActions"></span>` +
	`</div>`;

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>banco cg-workspace-colors</title>
<style>
	body { margin: 0; padding: 12px; background: #101215; color: #e6e8ea; font: 14px/20px system-ui, sans-serif; }
	.sidebar { width: 280px; padding: 8px; border-radius: 10px; background: #16181c; }
	.wnFoaW_projectRow { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 8px; border-radius: 8px; }
	.wnFoaW_slot { width: 16px; height: 20px; display: inline-flex; color: #8a9199; }
	.wnFoaW_projectText { flex-direction: column; flex: 1; gap: 2px; min-width: 0; display: flex; }
	.wnFoaW_title { text-overflow: ellipsis; white-space: nowrap; min-width: 0; font-size: 14px; line-height: 20px; overflow: hidden; }
</style>
<style data-cg-workspace-colors>${css}</style>
</head><body>
<div class="sidebar">
${row(A, 'Proyecto A con nombre largo')}
${row(B, 'Proyecto B')}
<div class="wnFoaW_projectRow" data-row-key="workspace:" id="ungrouped"><span class="wnFoaW_projectText"><span class="wnFoaW_title">Suelto</span></span></div>
</div>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'banco.html'), html, 'utf8');

// Manifiesto listo para ver.mjs (cg-capturas): asserts deterministas sobre el
// CSS ya resuelto por Chrome. No mira imagenes: devuelve numeros.
const pageUrl = 'file:///' + path.join(OUT, 'banco.html').replace(/\\/g, '/');
const evalExpr = `(() => {
	const A = ${JSON.stringify(A)};
	const B = ${JSON.stringify(B)};
	const a = document.querySelector('[data-row-key="workspace:' + A + '"]');
	const b = document.querySelector('[data-row-key="workspace:' + B + '"]');
	const u = document.querySelector('#ungrouped');
	const title = a.querySelector('[class*="_title"]');
	const folder = a.querySelector('[class*="_folder"]');
	const afterA = getComputedStyle(a, '::after');
	return {
		accent: getComputedStyle(a).boxShadow,
		tint: getComputedStyle(a).backgroundColor,
		badge: afterA.content,
		badgeColor: afterA.color,
		folderColor: folder === null ? null : getComputedStyle(folder).color,
		rowOverflow: a.scrollWidth - a.clientWidth,
		titleTruncated: title.scrollWidth > title.clientWidth,
		sinColorShadow: getComputedStyle(b).boxShadow,
		sinColorBadge: getComputedStyle(b, '::after').content,
		ungroupedBadge: getComputedStyle(u, '::after').content
	};
})()`;
fs.writeFileSync(
	path.join(HERE, 'banco.json'),
	JSON.stringify(
		{
			base: pageUrl,
			out: '_capturas',
			defaults: { width: 360, format: 'png', settle: 300, maxHeight: 150, scale: 2 },
			shots: [{ name: 'banco', url: pageUrl, checks: ['console'], eval: evalExpr }]
		},
		null,
		1
	),
	'utf8'
);

console.log('banco listo:', OUT);
console.log('manifiesto:', path.join(HERE, 'banco.json'));
console.log('css bytes:', css.length);

