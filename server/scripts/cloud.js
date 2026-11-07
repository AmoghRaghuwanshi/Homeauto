const fs = require('fs'); const path = require('path'); const http = require('http');
const { createPool, assertRuntimeRole, createPostgresCatalog } = require('../cloud/postgres');
const { migrate, migrationSQL, grantSQL } = require('../cloud/migrate');
const { createCloudApp } = require('../cloud/app');
const { inspectFile } = require('../cloud/sqlite-inspect');
async function main(args = process.argv.slice(2), env = process.env) {
  const [command, ...rest] = args;
  if (command === 'plan') { process.stdout.write(migrationSQL() + '\n'); return; }
  if (command === 'grants' && rest.length === 1) { process.stdout.write(grantSQL(rest[0]) + '\n'); return; }
  if (command === 'inspect' && rest.length === 1) { const {report}=await inspectFile(path.resolve(rest[0])); console.log(JSON.stringify(report,null,2)); return; }
  if (command === 'export-catalog' && rest.length === 3 && rest[2] === '--consent=catalog-v1') {
    const { report,catalog } = await inspectFile(path.resolve(rest[0])); if (!report.catalog_ready) throw new Error('Source preflight failed; inspect issues before export.');
    fs.writeFileSync(path.resolve(rest[1]), JSON.stringify(catalog,null,2), { flag:'wx',mode:0o600 }); console.log('Catalog exported locally; no database connection was made.'); return;
  }
  if (command === 'migrate' && rest.length === 1 && rest[0] === '--apply' && env.HOMEAUTO_CLOUD_MIGRATION_APPROVED === '1') {
    if (!env.DATABASE_URL_UNPOOLED || new URL(env.DATABASE_URL_UNPOOLED).hostname.includes('-pooler')) throw new Error('Migrations require the separately authorized direct PostgreSQL URL.');
    const pool=createPool(env.DATABASE_URL_UNPOOLED); try { console.log(await migrate(pool)); } finally { await pool.end(); } return;
  }
  if (command === 'serve' && !rest.length) {
    if (!env.HOMEAUTO_CLOUD_HUBS_FILE) throw new Error('Provide the private enrolled-hub registry file.');
    const hubs=JSON.parse(fs.readFileSync(env.HOMEAUTO_CLOUD_HUBS_FILE,'utf8'));
    const pool=createPool(env.DATABASE_URL); let server;
    try {
      await assertRuntimeRole(pool);
      const app=createCloudApp({store:createPostgresCatalog(pool),hubs});
      const port=Number(env.HOMEAUTO_CLOUD_PORT || 4000);
      if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('Invalid cloud API port');
      server=http.createServer(app); server.requestTimeout=10000; server.headersTimeout=10000;
      await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
      console.log('Catalog API listening on loopback port ' + port + '; an HTTPS reverse proxy is required.');
      let stopping=false;
      const stop=async()=>{if(stopping)return;stopping=true;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await pool.end();};
      process.once('SIGINT',stop);process.once('SIGTERM',stop); return {server,pool,stop};
    } catch(error) {server?.close();await pool.end();throw error;}
  }
  throw new Error('Usage: cloud.js plan | grants ROLE | inspect BACKUP | export-catalog BACKUP OUTPUT --consent=catalog-v1 | migrate --apply (approval env required) | serve');
}
if(require.main===module) main().catch(()=>{console.error('Cloud operation failed. Check the command, private configuration and database access; secrets are not logged.');process.exitCode=1;});
module.exports={main};
