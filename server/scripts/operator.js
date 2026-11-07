const readline = require('readline');
const { createRepository } = require('../db/repository');
const { Sessions, passwordHash } = require('../auth/sessions');
const { loadConfig } = require('../lifecycle');
const { text, fail } = require('../lib/errors');
async function main() {
  const [operation, username, role = 'owner'] = process.argv.slice(2); const config = loadConfig();
  if (!['add-user', 'reset-password', 'confirm-alias'].includes(operation) || !username) throw new Error('Usage: node scripts/operator.js add-user USER owner|resident|viewer; reset-password USER; confirm-alias ALIAS ROOM_ID');
  const repo = await createRepository({ filename: config.DB_PATH });
  try {
    if (operation === 'confirm-alias') {
      const room = repo.one('SELECT * FROM rooms WHERE id=?', [role]); if (!room) fail('ROOM_NOT_FOUND'); const alias = text(username).toLowerCase();
      if (repo.one('SELECT id FROM rooms WHERE name_key=? AND id<>?', [alias, room.id])) fail('ALIAS_CONFLICT');
      repo.write('INSERT OR REPLACE INTO room_aliases(alias,language,room_id,confirmed) VALUES(?,?,?,1)', [alias, 'mixed', room.id]); console.log('Room alias confirmed.'); return;
    }
    if (!process.stdin.isTTY) throw new Error('Use an interactive local terminal; passwords are never accepted as command arguments.');
    const password = await new Promise(resolve => {
      process.stdout.write('New password (12+ characters; hidden): '); const input = process.stdin; let value = '';
      readline.emitKeypressEvents(input); input.setRawMode(true); input.resume();
      const key = (str, event) => { if (event?.ctrl && event.name === 'c') process.exit(1); if (event?.name === 'return') { input.off('keypress', key); input.setRawMode(false); input.pause(); process.stdout.write('\n'); resolve(value); } else if (event?.name === 'backspace') value = value.slice(0, -1); else if (str && !event?.ctrl) value += str; }; input.on('keypress', key);
    });
    if (operation === 'add-user') await new Sessions(repo).addUser({ username, password, role, can_unlock: role === 'owner' });
    else { const user = repo.one('SELECT id FROM users WHERE username=?', [username.toLowerCase()]); if (!user) fail('USER_NOT_FOUND'); const encoded = await passwordHash(password); repo.transaction(tx => { tx.run('UPDATE users SET password_hash=? WHERE id=?', [encoded, user.id]); tx.run('DELETE FROM sessions'); repo.log(null, 'password_reset', {}, user.id, null, tx); }); }
    console.log('Local account updated. Stop the hub before running operator commands.');
  } finally { repo.close(); }
}
if (require.main === module) main().catch(e => { console.error(e.code || e.message); process.exitCode = 1; });
module.exports = { main };
