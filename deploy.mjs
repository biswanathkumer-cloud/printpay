import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = fs.readFileSync('wrangler.base.toml','utf8');
let raw = execFileSync('npx', ['wrangler','d1','list','--json'], {encoding:'utf8', stdio:['ignore','pipe','inherit']});
let data;
try { data = JSON.parse(raw); } catch { throw new Error('Cloudflare D1 list did not return JSON.'); }
const rows = Array.isArray(data) ? data : (data.result || data.databases || []);
const db = rows.find(x => x.name === 'printpay-db' || x.database_name === 'printpay-db');
if (!db) throw new Error('D1 database "printpay-db" was not found. Create it first or check the Workers Build token permissions.');
const id = db.uuid || db.id || db.database_id;
const name = db.name || db.database_name || 'printpay-db';
if (!id) throw new Error('D1 database "printpay-db" was found but its database ID was missing.');
const config = `${base}\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = ${JSON.stringify(name)}\ndatabase_id = ${JSON.stringify(id)}\n`;
fs.writeFileSync('wrangler.generated.toml', config);
console.log(`Using D1 ${name} (${id})`);
execFileSync('npx', ['wrangler','deploy','--config','wrangler.generated.toml'], {stdio:'inherit'});
