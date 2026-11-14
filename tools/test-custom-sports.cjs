const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'app/js/custom-sports.js'), 'utf8');
function moduleWith(TV = {}, extra = {}) {
    const context = { window: { TV, setTimeout: fn => fn(), clearInterval() {}, setInterval() {} }, ...extra };
    vm.runInNewContext(script, context);
    return context.window.APL_CUSTOM_SPORTS;
}
const custom = moduleWith();
const source = fs.readFileSync(path.join(root, 'app/js/sports.js'), 'utf8');
const parserContext = { leftOut: () => false, Date };
vm.runInNewContext(source.slice(source.indexOf('    function team(x)'), source.indexOf('    /* ---------- 365Scores:')), parserContext);
const parse = parserContext.readEvent;
const old = { sports: ['soccer', 'cricket', 'mma'], leagues: ['soccer/eng.1', 'mma/ufc', 'cricket/sri-lanka'], teams: [{ s: 'soccer', id: 'x', n: 'Existing club' }], types: { men: 1, women: 0 }, customSportsVersion: 1 };
assert.equal(custom.enhance(old), true);
assert.equal(old.leagues.join(','), 'soccer/eng.1,mma/ufc,cricket/international');
assert.equal(old.teams[0].n, 'Existing club');
assert.ok(old.teams.some(t => t.s === 'cricket' && t.n === 'Sri Lanka' && t.nat));
assert.equal(custom.enhance(old), false);
const fresh = { sports: ['soccer'], leagues: ['soccer/eng.1'], teams: [], types: { men: 1 } };
custom.enhance(fresh);
assert.equal(fresh.sports.join(','), 'soccer', 'new users must not be forced to follow UFC');
assert.equal(fresh.teams.length, 0);
assert.equal(custom.enhance({}), false);
assert.equal(custom.enhance({ skipped: 1 }), false);
assert.equal(custom.promotions.map(p => p[0]).join(','), 'ufc,pfl');
assert.equal(custom.cricket.length, 8);
assert.equal(custom.nationalTeams().filter(t => t.name === 'Sri Lanka').length, 1);
assert.ok(custom.nationalTeams().find(t => t.name === 'Nepal').logo.endsWith('/33.png'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'app/version.json'), 'utf8'));
const installedHtml = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
manifest.styles.forEach(style => assert.ok(installedHtml.includes('href="' + style + '"'), 'installed page must load ' + style));
const order = [{ id: 'ufc', sport: 'mma', state: 'pre', start: 100 }, { id: 'cricket', sport: 'cricket', state: 'in', start: 200 }, { id: 'football', sport: 'soccer', state: 'pre', start: 50 }].sort(custom.compare);
assert.equal(order.map(m => m.id).join(','), 'cricket,football,ufc');
const fighter = (id, name) => ({ id, athlete: { displayName: name }, winner: 'false' });
const bout = (id, state, image) => ({ id, date: '2026-11-15T01:00:00Z', competitors: [fighter('a', 'One Fighter'), fighter('b', 'Two Fighter')], type: { abbreviation: 'Heavyweight' }, status: { type: { state } }, images: image ? [{ href: image }] : [] });
const raw = { events: [{ id: '334', name: 'UFC 334: Test', date: '2026-11-15T01:00:00Z', competitions: [bout('prelim', 'post'), bout('main', 'in', 'https://example.org/bout.jpg')] }] };
const grouped = custom.events(raw, 'mma', parse, custom.promotions[0]);
assert.equal(grouped.length, 1, 'one sports tile per event');
assert.equal(grouped[0].bouts.length, 2, 'the entire card is retained');
assert.equal(grouped[0].state, 'in', 'a live bout makes its parent live');
const between = custom.events({ events: [{ ...raw.events[0], status: { type: { state: 'in' } }, competitions: [bout('done', 'post'), bout('next', 'pre')] }] }, 'mma', parse, custom.promotions[0]);
assert.equal(between[0].state, 'in', 'events stay live between bouts when the source marks the event live');
assert.notEqual(grouped[0].bouts[0].id, grouped[0].bouts[1].id);
assert.equal(grouped[0].bouts[0].home.winner, false);
assert.equal(grouped[0].sourceEvent, '334');
assert.equal(custom.events(raw, 'mma', parse, custom.promotions[0], { ufcEventType: 'numbered' }).length, 1);
assert.equal(custom.events(raw, 'mma', parse, custom.promotions[0], { ufcEventType: 'fight-night' }).length, 0);
assert.equal(custom.events({ events: [{ ...raw.events[0], name: 'UFC Fight Night: Test' }] }, 'mma', parse, custom.promotions[0], { ufcEventType: 'numbered' }).length, 0);
const pfl = custom.events(raw, 'mma', parse, custom.promotions[1]);
assert.notEqual(pfl[0].id, grouped[0].id, 'promotion IDs cannot collide');
assert.equal(pfl[0].sourceLeague, 'pfl');
const cricketEvent = (id, name, klass = '1') => ({ id, date: '2026-11-10T04:00:00Z', endDate: '2026-11-15T23:59:00Z', competitions: [{ class: { internationalClassId: klass }, status: { type: { state: 'in', detail: 'Day 5' } }, competitors: [
    { homeAway: 'away', team: { id: '8', displayName: name }, score: '300/4', winner: 'false' },
    { homeAway: 'home', team: { id: '7', displayName: 'Pakistan' }, score: '250', winner: 'false' }
] }] });
const sl = { teams: [{ s: 'cricket', nat: 1, n: 'Sri Lanka' }] };
const cricket = custom.events({ leagues: [{ id: '24704' }], events: [cricketEvent('sl', 'Sri Lanka'), cricketEvent('women', 'Sri Lanka Women', '9'), cricketEvent('india', 'India'), cricketEvent('a', 'Sri Lanka A'), cricketEvent('club', 'Colombo', '4')] }, 'cricket', parse, custom.cricket[0], sl);
assert.equal(cricket.length, 2);
assert.equal(cricket[0].away.name, 'Sri Lanka');
assert.equal(cricket[0].sourceLeague, '24704');
assert.equal(cricket[0].away.score, '300/4');
assert.equal(cricket[0].away.winner, false);
assert.equal(cricket[1].women, true);
const from = Date.parse('2026-11-14'), to = Date.parse('2026-11-30');
assert.equal(custom.inSpan(cricket[0], from, to), true, 'live Tests stay on later days');
assert.equal(custom.inSpan({ ...cricket[0], state: 'post' }, from, to), false);
assert.equal(custom.favTeam(cricket[0].away, sl.teams), true);
const franchise = custom.events({ leagues: [{ id: '8048' }], events: [cricketEvent('club', 'Chennai Super Kings', '6')] }, 'cricket', parse, custom.cricket[1]);
assert.equal(franchise.length, 1, 'franchise cricket is not filtered as national cricket');
const series = custom.cricketSeries({ leagues: [
    { id: '1', name: 'Sri Lanka in Pakistan Test Series', season: { year: 2026 } },
    { id: '2', name: 'Sri Lanka A unofficial ODI Series', season: { year: 2026 } },
    { id: '3', name: 'ICC World Cup', season: { year: 2026 } },
    { id: '4', name: 'India in England ODI Series', season: { year: 2026 } },
    { id: 'bad/path', name: 'Sri Lanka ODI Series', season: { year: 2026 } }
] }, from, to, sl);
assert.equal(series.map(x => x.id).join(','), '1,3');
assert.ok(!source.includes('CUSTOM.priority'));
assert.ok(!source.includes('var ufcRow'));
assert.ok(source.includes('CUSTOM.openEvent(m,'));
assert.ok(source.includes('CUSTOM.clubTeams(slug, limited)'));
assert.ok(source.includes('CUSTOM.nationalTeams()'));
assert.ok(source.includes('CUSTOM.inSpan(m, from, to)'));
assert.ok(fs.readFileSync(path.join(root, 'app/js/boot.js'), 'utf8').includes('"siddeekazeez/APL-TV"'));
const helperCode = fs.readFileSync(path.join(root, 'app/js/helper.js'), 'utf8');
function helperPort(bridge) { const host = { window: { TV: {}, APLAndroid: bridge }, setInterval() {} }; vm.runInNewContext(helperCode, host); return host.window.TV.helper.PORT; }
assert.equal(helperPort({ helperPort: () => 8766 }), 8766);
assert.equal(helperPort({}), 8765);
assert.equal(helperPort(), 8765);
assert.ok(fs.readFileSync(path.join(root, 'android/app/src/main/java/com/knikt/apltv/Helper.java'), 'utf8').includes('static final int PORT = 8766;'));
console.log('Sports grouping, preference migration, live ordering, cricket selections and phone helper tests passed');

(async function () {
    let requests = 0, fail = false, now = Date.parse('2026-11-14');
    class Clock extends Date { static now() { return now; } }
    const loader = moduleWith({ log() {}, fetchJSON: async url => {
        requests++;
        if (fail) throw new Error('offline');
        if (url.includes('leagues/dropdown')) return { leagues: [{ id: '24704', name: 'Sri Lanka in Pakistan Test Series', season: { year: 2026 } }] };
        return { leagues: [{ id: '24704' }], events: [cricketEvent('sl', 'Sri Lanka')] };
    } }, { Date: Clock });
    assert.equal((await loader.range('cricket', from, to, task => task(), parse, loader.cricket[0], sl)).length, 1);
    assert.equal(requests, 2);
    await loader.range('cricket', from, to, task => task(), parse, loader.cricket[0], sl);
    assert.equal(requests, 2);
    now += 31000; fail = true;
    assert.equal((await loader.range('cricket', from, to, task => task(), parse, loader.cricket[0], sl)).length, 1, 'source outage keeps last known matches');
    const offline = moduleWith({ log() {}, fetchJSON: async () => { throw new Error('offline'); } });
    await assert.rejects(offline.range('cricket', from, to, task => task(), parse), /offline/);
    let artRequests = 0;
    const poster = { strEvent: 'UFC 334: Test', strTimestamp: '2026-11-15T01:00:00Z', strFanart: 'https://example.org/event.jpg' };
    const art = moduleWith({ load: () => ({}), save() {}, fetchJSON: async () => { artRequests++; return { event: [poster] }; } });
    const event = grouped[0];
    assert.equal((await art.artwork(event)).u, 'https://example.org/event.jpg');
    assert.equal((await art.artwork(event.bouts[0])).u, 'https://example.org/event.jpg', 'missing bout image falls back to its parent');
    assert.equal((await art.artwork(event.bouts[1])).u, 'https://example.org/bout.jpg', 'individual image wins over event art');
    assert.equal(artRequests, 2, 'event lookup is shared; missing bout artwork gets its own lookup');
    const boutPoster = { ...poster, strEvent: 'One Fighter vs Two Fighter', strThumb: 'https://example.org/matchup.jpg' };
    assert.equal(art.matchBoutArtwork({ event: [boutPoster] }, event.bouts[0]), boutPoster);
    assert.equal(art.matchBoutArtwork({ event: [{ ...boutPoster, strEvent: 'One Fighter vs Someone Else' }] }, event.bouts[0]), undefined);
    assert.equal(art.matchArtwork({ event: [{ ...poster, strEvent: 'UFC 333: Test' }] }, event), undefined);
    assert.equal(art.matchArtwork({ event: [{ ...poster, strTimestamp: '2020-01-01' }] }, event), undefined);
    let fallbackCalls = [];
    const clubs = moduleWith({ fetchJSON: async url => {
        fallbackCalls.push(url);
        if (fallbackCalls.length === 1) throw new Error('season not published');
        return { teams: [{ id: '1', displayName: 'Club One', logos: [{ href: 'https://example.org/logo.png' }] }] };
    } });
    assert.equal((await clubs.clubTeams('8048', task => task()))[0].name, 'Club One');
    assert.equal(fallbackCalls.length, 2);
    console.log('Artwork matching/fallback, season fallback, source caching and outage tests passed');
    if (process.env.SPORTS_FIXTURE_DIR) {
        const dir = process.env.SPORTS_FIXTURE_DIR;
        const ufc = JSON.parse(fs.readFileSync(path.join(dir, 'ufc.json')));
        const real = custom.events(ufc, 'mma', parse, custom.promotions[0]);
        assert.equal(real.length, ufc.events.length);
        assert.equal(real.reduce((n, e) => n + e.bouts.length, 0), ufc.events.reduce((n, e) => n + e.competitions.filter(c => c.competitors.length === 2).length, 0));
        const realPfl = custom.events(JSON.parse(fs.readFileSync(path.join(dir, 'apl-pfl.json'))), 'mma', parse, custom.promotions[1]);
        assert.ok(realPfl.length && realPfl.every(m => m.sourceLeague === 'pfl'));
        const ipl = custom.events(JSON.parse(fs.readFileSync(path.join(dir, 'apl-iplschedule.json'))), 'cricket', parse, custom.cricket[1]);
        assert.equal(ipl.length, 74);
        console.log('Real ESPN fixtures passed: ' + real.length + ' UFC events, ' + realPfl.length + ' PFL events, ' + ipl.length + ' IPL matches');
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
