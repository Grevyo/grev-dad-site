// Run with a bundled grev-home-messages module as the first argument.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
const {canMessage,directRoom}=await import(pathToFileURL(process.argv[2]));
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,status TEXT);
CREATE TABLE grev_home_friendships(user_low_id TEXT,user_high_id TEXT);
CREATE TABLE profile_blocks(owner_user_id TEXT,blocked_user_id TEXT);
CREATE TABLE chat_rooms(id TEXT PRIMARY KEY,room_type TEXT,title TEXT,created_by TEXT,created_at INTEGER,updated_at INTEGER);
CREATE TABLE chat_members(room_id TEXT,user_id TEXT,joined_at INTEGER,PRIMARY KEY(room_id,user_id));`);
const db={prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){return sqlite.prepare(sql).get(...values)??null},async all(){return {results:sqlite.prepare(sql).all(...values)}},async run(){return sqlite.prepare(sql).run(...values)}}},async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results}};
const a='10000000-0000-4000-8000-000000000001',b='20000000-0000-4000-8000-000000000002';
sqlite.prepare('INSERT INTO users VALUES (?,?)').run(a,'active');
sqlite.prepare('INSERT INTO users VALUES (?,?)').run(b,'active');
assert.equal(await canMessage(db,a,b),false,'strangers rejected');
sqlite.prepare('INSERT INTO grev_home_friendships VALUES (?,?)').run(a,b);
assert.equal(await canMessage(db,a,b),true,'friends allowed');
assert.equal(await canMessage(db,b,a),true,'both directions allowed');
assert.equal(await canMessage(db,a,a),false,'self rejected');
for(const [owner,blocked] of [[a,b],[b,a]]){
sqlite.prepare('INSERT INTO profile_blocks VALUES (?,?)').run(owner,blocked);
assert.equal(await canMessage(db,a,b),false,'either block direction rejected');
sqlite.exec('DELETE FROM profile_blocks');
}
sqlite.prepare('UPDATE users SET status=? WHERE id=?').run('disabled',b);
assert.equal(await canMessage(db,a,b),false,'disabled account rejected');
sqlite.prepare('UPDATE users SET status=? WHERE id=?').run('active',b);
const [first,second]=await Promise.all([directRoom(db,a,b),directRoom(db,b,a)]);
assert.equal(first,second,'simultaneous opens share a room');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM chat_rooms').get().n,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM chat_members').get().n,2);
console.log('PASS: strangers, friends, self, both block directions, disabled users and simultaneous room creation');
