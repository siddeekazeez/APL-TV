const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'app/js/custom-sports.js'), 'utf8'), ctx);
const custom = ctx.window.APL_CUSTOM_SPORTS;
const prefs = { sports: ['soccer', 'basketball'], leagues: ['soccer/eng.1', 'basketball/nba'], teams: [{ id: '1' }], types: { men: 1 } };
const original = JSON.parse(JSON.stringify(prefs));
assert.equal(custom.enhance(prefs), true);
assert.deepEqual(prefs.sports.slice(0, 2), original.sports);
assert.deepEqual(prefs.leagues.slice(0, 2), original.leagues);
assert.deepEqual(prefs.teams, original.teams);
assert.deepEqual(prefs.types, original.types);
assert.equal(custom.enhance(prefs), false);
prefs.sports.splice(prefs.sports.indexOf('mma'), 1);
assert.equal(custom.enhance(prefs), false, 'do not override subsequent user choices');
assert.equal(custom.enhance({ skipped: 1 }), false);
assert.equal(custom.enhance({}), false);
assert.ok(custom.priority({ sport: 'mma' }) < custom.priority({ sport: 'soccer' }));

// Exercise the adapter with the actual upstream parser, including the team-shaped MMA conversion.
const source = fs.readFileSync(path.join(root, 'app/js/sports.js'), 'utf8');
const functions = source.slice(source.indexOf('    function team(x)'), source.indexOf('    /* ---------- 365Scores:'));
const parserContext = { leftOut: () => false, Date };
vm.runInNewContext(functions, parserContext);
const parse = parserContext.readEvent;
const fighters = ['Fighter One', 'Fighter Two'].map((name, i) => ({ id: String(i), athlete: { displayName: name }, winner: i === 0 }));
const bout = id => ({ id, date: '2026-11-15T01:00:00Z', competitors: fighters, status: { type: { state: 'pre' } } });
const fights = custom.events({ events: [{ id: 'event', name: 'UFC Test', date: '2026-11-15T01:00:00Z', competitions: [bout('early'), bout('main')] }] }, 'mma', parse);
assert.equal(fights.length, 2, 'keep every bout, not just the first prelim');
assert.notEqual(fights[0].id, fights[1].id);
assert.equal(fights[0].home.name, 'Fighter One');
assert.equal(fights[0].sourceEvent, 'event');
const cricketEvent = (name, klass) => ({ id: name, date: '2026-11-10T04:00:00Z', endDate: '2026-11-15T23:59:00Z', competitions: [{
    class: { internationalClassId: klass }, status: { type: { state: 'in', detail: 'Day 5 - Sri Lanka lead' } },
    competitors: [{ homeAway: 'away', team: { id: '8', displayName: name }, score: '300/4', winner: 'false' },
        { homeAway: 'home', team: { id: '7', displayName: 'Pakistan' }, score: '250', winner: 'false' }]
}] });
const cricket = custom.events({ leagues: [{ id: '24704' }], events: [cricketEvent('Sri Lanka', '1'), cricketEvent('Sri Lanka Women', '9'), cricketEvent('Sri Lanka A', '1'), cricketEvent('Colombo', '4')] }, 'cricket', parse);
assert.equal(cricket.length, 2);
assert.equal(cricket[0].away.name, 'Sri Lanka');
assert.equal(cricket[0].away.winner, false, 'the string false must not become a win');
assert.equal(cricket[0].sourceLeague, '24704');
assert.equal(cricket[0].women, false);
assert.equal(cricket[1].women, true);
assert.equal(custom.inSpan(cricket[0], Date.parse('2026-11-14'), Date.parse('2026-11-15')), true, 'a live Test remains visible after its first day');
assert.equal(custom.inSpan({ ...cricket[0], state: 'post' }, Date.parse('2026-11-14'), Date.parse('2026-11-15')), false);
const from = Date.parse('2026-11-14'), to = Date.parse('2026-11-30');
const series = custom.cricketSeries({ leagues: [
    { id: '1', name: 'Sri Lanka in Pakistan Test Series', season: { year: 2026 } },
    { id: '2', name: 'Sri Lanka A unofficial ODI Series', season: { year: 2026 } },
    { id: '3', name: 'ICC World Cup', season: { year: 2026 } },
    { id: '4', name: 'Sri Lanka ODI Series', season: { year: 2020 } },
    { id: 'invalid/path', name: 'Sri Lanka', season: { year: 2026 } }
] }, from, to);
assert.equal(series.map(x => x.id).join(','), '1,3');
assert.ok(source.includes('CUSTOM.inSpan(m, from, to)'));
assert.ok(source.indexOf('addRow("mma/ufc"') < source.indexOf('addRow("mine"'));
assert.ok(fs.readFileSync(path.join(root, 'app/js/boot.js'), 'utf8').includes('"siddeekazeez/APL-TV"'));
console.log('Custom sports tests passed');

// Optional real ESPN responses, kept outside Git: no user playlists or credentials in fixtures.
if (process.env.SPORTS_FIXTURE_DIR) {
    const dir = process.env.SPORTS_FIXTURE_DIR;
    const ufc = JSON.parse(fs.readFileSync(path.join(dir, 'ufc.json')));
    const sl = JSON.parse(fs.readFileSync(path.join(dir, 'sri-lanka.json')));
    const actual = custom.events(ufc, 'mma', parse);
    assert.equal(actual.length, ufc.events.reduce((n, e) => n + e.competitions.filter(c => c.competitors.length === 2).length, 0));
    assert.ok(actual.every(m => m.home.name && m.away.name));
    assert.ok(custom.events(sl, 'cricket', parse).length > 0);
    console.log('Live ESPN fixture tests passed: ' + actual.length + ' UFC bouts');
}

(async function () {
    let requests = 0, fail = false, now = Date.now();
    class Clock extends Date { static now() { return now; } }
    const env = { window: { TV: { log() {}, fetchJSON: async url => {
        requests++;
        if (fail) throw new Error('offline');
        if (url.includes('leagues/dropdown')) return { leagues: [{ id: '24704', name: 'Sri Lanka in Pakistan Test Series', season: { year: 2026 } }] };
        return { leagues: [{ id: '24704' }], events: [cricketEvent('Sri Lanka', '1')] };
    } } }, Date: Clock };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app/js/custom-sports.js'), 'utf8'), env);
    const loader = env.window.APL_CUSTOM_SPORTS;
    const first = await loader.range('cricket', from, to, task => task(), parse);
    assert.equal(first.length, 1);
    assert.equal(requests, 2);
    await loader.range('cricket', from, to, task => task(), parse);
    assert.equal(requests, 2, 'cached results avoid repeated source calls');
    now += 31000; fail = true;
    assert.equal((await loader.range('cricket', from, to, task => task(), parse)).length, 1, 'keep last known matches during a source outage');
    const fresh = { window: { TV: { log() {}, fetchJSON: async () => { throw new Error('offline'); } } } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app/js/custom-sports.js'), 'utf8'), fresh);
    await assert.rejects(fresh.window.APL_CUSTOM_SPORTS.range('cricket', from, to, task => task(), parse), /offline/);
    console.log('Sports source caching and failure tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
