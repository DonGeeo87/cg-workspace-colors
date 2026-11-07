// Compuerta de cg-workspace-colors.
//
// Corre el banco (test/banco.mjs) y las capturas-assert de cg-capturas
// (test/banco.json), y falla si el CSS resuelto por Chrome no es el esperado.
// No mira imagenes: compara valores calculados.
//
//   node test/compuerta.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const VER = path.join(process.env.USERPROFILE ?? '', '.dsh', 'skills', 'cg-capturas', 'scripts', 'ver.mjs');

/** Corre un comando y corta si falla. */
function run(command, args) {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.status !== 0) {
		console.error('fallo: ' + command + ' ' + args.join(' '));
		process.exit(1);
	}
}

run(process.execPath, [path.join(HERE, 'banco.mjs')]);
if (!fs.existsSync(VER)) {
	console.error('falta ver.mjs de cg-capturas: ' + VER);
	process.exit(1);
}
run(process.execPath, [VER, '--cfg', path.join(HERE, 'banco.json')]);

const report = JSON.parse(fs.readFileSync(path.join(HERE, '_capturas', 'report.json'), 'utf8'));
const got = report.shots?.[0]?.eval;
if (got === undefined) {
	console.error('la captura no devolvio mediciones');
	process.exit(1);
}

/** Lo que el banco tiene que dar: fila con color, badge de dos estados, fila limpia. */
const expected = {
	accent: 'rgb(16, 185, 129) 2px 0px 0px 0px inset',
	badge: '"1 pend. · 1 act."',
	badgeColor: 'rgb(217, 119, 6)',
	folderColor: 'rgb(16, 185, 129)',
	rowOverflow: 0,
	titleTruncated: true,
	sinColorShadow: 'none',
	sinColorBadge: '""',
	ungroupedBadge: '""'
};

const problems = [];
for (const [key, want] of Object.entries(expected)) {
	if (got[key] !== want) problems.push(`${key}: esperaba ${JSON.stringify(want)}, obtuve ${JSON.stringify(got[key])}`);
}
if (typeof got.tint !== 'string' || !got.tint.startsWith('color(srgb')) problems.push('tint: no se aplico color-mix (' + got.tint + ')');

if (problems.length > 0) {
	console.error('compuerta FALLA:');
	for (const problem of problems) console.error('  - ' + problem);
	process.exit(1);
}
console.log('compuerta OK: color de fila, badge compacto, tono de pendiente y fila sin color');
