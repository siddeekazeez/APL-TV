/* Independent sports integration for Knikt's APL TV. MIT; see CUSTOMIZATIONS.md. */
(function (global) {
    "use strict";
    var API = "https://site.api.espn.com/apis/site/v2/", directory, directoryAt = 0, memo = {}, seasons = {};
    var promotions = [["ufc", "UFC"], ["pfl", "PFL"]];
    var cricket = [["international", "International Cricket", "i"], ["8048", "IPL", "", "India"], ["8044", "BBL", "", "Australia"],
        ["8679", "PSL", "", "Pakistan"], ["8623", "CPL", "", "West Indies"], ["21275", "SA20", "", "South Africa"],
        ["20921", "ILT20", "", "United Arab Emirates"], ["19943", "LPL", "", "Sri Lanka"]];
    var countries = [["Afghanistan", "40"], ["Australia", "2"], ["Bangladesh", "25"], ["England", "1"], ["India", "6"], ["Ireland", "29"],
        ["New Zealand", "5"], ["Pakistan", "7"], ["South Africa", "3"], ["Sri Lanka", "8"], ["West Indies", "4"], ["Zimbabwe", "9"],
        ["Canada", "17"], ["Namibia", "28"], ["Nepal", "33"], ["Netherlands", "15"], ["Oman", "37"], ["Scotland", "30"], ["United Arab Emirates", "27"], ["United States of America", "11"]];
    function fold(s) { return String(s || "").toLowerCase().replace(/women/g, "").replace(/[^a-z0-9]/g, ""); }
    function nationalTeams() { return countries.map(function (c) { return { id: "nation:" + fold(c[0]), name: c[0], short: c[0],
        logo: "https://a.espncdn.com/i/teamlogos/cricket/500/" + c[1] + ".png", l: "cricket/international", g: "" }; }); }
    function enhance(f) {
        if (!f || f.skipped || !Array.isArray(f.sports) || !Array.isArray(f.leagues) || f.customSportsVersion >= 2) return false;
        // Only migrate the old Sri Lanka-only selection; don't subscribe other users to new sports.
        var i = f.leagues.indexOf("cricket/sri-lanka");
        if (i >= 0) {
            f.leagues.splice(i, 1);
            if (f.leagues.indexOf("cricket/international") < 0) f.leagues.push("cricket/international");
            f.teams = f.teams || [];
            if (!f.teams.some(function (t) { return t.s === "cricket" && fold(t.n) === "srilanka"; })) {
                var t = nationalTeams().filter(function (x) { return x.name === "Sri Lanka"; })[0];
                f.teams.push({ s: "cricket", l: t.l, id: t.id, n: t.name, logo: t.logo, nat: 1 });
            }
        }
        f.customSportsVersion = 2;
        return true;
    }
    function favTeam(t, selections) { return (selections || []).some(function (x) {
        return x.s === "cricket" && (x.nat ? fold(x.n) === fold(t.name) : String(x.id) === String(t.id));
    }); }
    function cricketSeries(j, from, to, selected) {
        var names = (selected && selected.teams || []).filter(function (t) { return t.s === "cricket" && t.nat; }).map(function (t) { return fold(t.n); });
        return (j.leagues || []).filter(function (l) {
            var s = l.season || {}, n = l.name || "", y = Number(s.year);
            return /^\d+$/.test(String(l.id)) && (!y || y >= new Date(from).getUTCFullYear() - 1 && y <= new Date(to).getUTCFullYear() + 1) &&
                (!s.endDate || Date.parse(s.endDate) >= from) && !/Under.?19|Youth|unofficial|Academy|A-Team|\bA (?:tour|in |v )/i.test(n) && /Test|ODI|T20I|World Cup|Champions Trophy|Asia Cup/i.test(n) &&
                (!names.length || names.some(function (name) { return fold(n).indexOf(name) >= 0; }) || /World (?:Test Championship|Cup)|Champions Trophy|Asia Cup/i.test(n));
        });
    }
    function image(x) {
        var u = typeof x === "string" ? x : x && (x.href || x.url);
        return /^https:\/\//i.test(u || "") ? u : "";
    }
    function images(x) { var list = x.images || x.logos || []; return image(x.image) || list.map(image).filter(Boolean)[0] || ""; }
    function eventState(bouts) {
        return bouts.some(function (m) { return m.state === "in"; }) ? "in" : bouts.every(function (m) { return m.state === "post"; }) ? "post" : "pre";
    }
    function events(j, sport, parse, lg, selected) {
        lg = lg || (sport === "mma" ? promotions[0] : cricket[0]);
        var out = [];
        (j.events || []).forEach(function (e) {
            if (sport === "mma" && lg[0] === "ufc" && selected) {
                var numbered = /\bUFC\s*\d+\b/i.test(e.name || ""), wanted = selected.ufcEventType || "all";
                if (wanted === "numbered" && !numbered || wanted === "fight-night" && numbered) return;
            }
            var bouts = [], sourceLg = sport === "mma" ? lg[0] : String((j.leagues || [])[0] && j.leagues[0].id || lg[0]);
            (e.competitions || []).forEach(function (c) {
                if (!c.competitors || c.competitors.length !== 2) return;
                var klass = Number((c.class || {}).internationalClassId), intl = [1, 2, 3, 8, 9, 10].indexOf(klass) >= 0;
                if (sport === "cricket" && lg[0] === "international") {
                    if (!intl) return;
                    var choices = (selected && selected.teams || []).filter(function (t) { return t.s === "cricket" && t.nat; });
                    if (choices.length && !c.competitors.some(function (x) { return choices.some(function (t) { return fold(t.n) === fold((x.team || {}).displayName || (x.team || {}).name); }); })) return;
                }
                var copy = {}, k;
                for (k in e) copy[k] = e[k];
                copy.competitions = [c]; copy.date = c.date || e.date; copy.status = c.status || e.status;
                copy.id = sport === "mma" ? e.id + "-" + c.id : e.id;
                if (sport === "mma") {
                    var bout = {};
                    for (k in c) bout[k] = c[k];
                    bout.competitors = c.competitors.map(function (x, i) {
                        var a = x.athlete || {}, t = {}, key;
                        for (key in x) t[key] = x[key];
                        t.homeAway = i ? "away" : "home";
                        t.team = { id: x.id, displayName: a.displayName || a.fullName || "TBA", shortDisplayName: a.shortName,
                            logo: image(a.headshot) || image(a.flag) };
                        t.winner = x.winner === true || x.winner === "true";
                        return t;
                    });
                    copy.competitions = [bout];
                }
                var m = parse(copy, { id: sport }, lg);
                if (!m) return;
                m.sourceEvent = String(e.id); m.sourceLeague = sourceLg;
                m.end = Date.parse(c.endDate || e.endDate) || m.start;
                m.women = [8, 9, 10].indexOf(klass) >= 0;
                m.eventTitle = e.name || e.shortName || lg[1]; m.eventDate = e.date;
                m.art = images(c); m.eventArt = images(e);
                m.note = sport === "mma" ? (c.type || {}).abbreviation || "" : e.description || "";
                // Preserve source card labels only; never infer prelim/main-card membership from position.
                var group = c.cardSegment || c.cardType || c.group || {};
                m.cardSection = typeof group === "string" ? group : group.displayName || group.name || "";
                if (sport === "cricket") {
                    m.live = ((c.status || e.status || {}).type || {}).detail || "";
                    var h = c.competitors[0].homeAway === "away" ? c.competitors[1] : c.competitors[0], a = h === c.competitors[0] ? c.competitors[1] : c.competitors[0];
                    m.home.winner = h.winner === true || h.winner === "true"; m.away.winner = a.winner === true || a.winner === "true";
                    out.push(m);
                } else bouts.push(m);
            });
            if (sport !== "mma" || !bouts.length) return;
            var headline = bouts.filter(function (b) {
                var title = fold(e.name), last = function (n) { return fold(n.split(" ").pop()); };
                return title.indexOf(last(b.home.name)) >= 0 && title.indexOf(last(b.away.name)) >= 0;
            })[0] || bouts[bouts.length - 1];
            var event = {};
            for (var key in headline) event[key] = headline[key];
            event.id = "mma:" + sourceLg + ":" + e.id; event.isEvent = true; event.bouts = bouts;
            event.start = Date.parse(e.date) || headline.start; event.state = eventState(bouts);
            var rootState = ((e.status || {}).type || {}).state;
            if (rootState === "in" || event.state === "in") event.state = "in";
            else if (rootState === "post") event.state = "post";
            event.art = images(e); event.note = "";
            event.status = ((e.status || {}).type || {}).name || "";
            out.push(event);
        });
        return out;
    }
    function date(t) { return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
    function yearList(from, to) {
        var a = new Date(from).getUTCFullYear(), b = new Date(to).getUTCFullYear(), list = [];
        for (var y = a - 1; y <= b; y++) list.push(y);
        return list;
    }
    function season(slug, year, fetch) {
        var key = slug + "/" + year, c = seasons[key];
        if (c && Date.now() - c.at < (c.live ? 30000 : 600000)) return Promise.resolve(c.data);
        return fetch("sports/cricket/" + slug + "/scoreboard?season=" + year + "&limit=500").then(function (j) {
            seasons[key] = { at: Date.now(), data: j, live: (j.events || []).some(function (e) { var state = ((e.status || {}).type || {}).state; return state === "in" || state === "pre" && Math.abs(Date.parse(e.date) - Date.now()) < 20 * 60000; }) };
            return j;
        });
    }
    function range(sport, from, to, limited, parse, lg, selected) {
        lg = lg || (sport === "mma" ? promotions[0] : cricket[0]);
        var key = sport + "/" + lg[0] + "/" + from + "/" + to + "/" + JSON.stringify(selected && selected.teams || []), old = memo[key], now = Date.now();
        if (old && now - old.at < (old.list.some(function (m) { return m.state === "in" || m.state === "pre" && Math.abs(m.start - now) < 20 * 60000; }) ? 30000 : 600000)) return Promise.resolve(old.list);
        function fetch(path) { return limited(function () { return global.TV.fetchJSON(API + path, { timeout: 20000 }); }); }
        var jobs;
        if (sport === "mma") jobs = Promise.resolve([function () { return fetch("sports/mma/" + lg[0] + "/scoreboard?dates=" + date(from) + "-" + date(to - 1) + "&limit=500"); }]);
        else if (lg[0] !== "international") jobs = Promise.resolve(yearList(from, to).map(function (year) { return function () { return season(lg[0], year, fetch); }; }));
        else {
            if (!directory || now - directoryAt > 6 * 3600000) {
                directoryAt = now;
                directory = fetch("leagues/dropdown?region=us&lang=en&sport=cricket").catch(function (e) { directory = null; throw e; });
            }
            jobs = directory.then(function (j) { return cricketSeries(j, from - 7 * 86400000, to, selected).map(function (l) {
                return function () { return fetch("sports/cricket/" + l.id + "/scoreboard?dates=" + date(from - 7 * 86400000) + "-" + date(to - 1) + "&limit=500"); };
            }); });
        }
        return jobs.then(function (list) {
            var failed = 0;
            return Promise.all(list.map(function (job) { return job().then(function (j) { return events(j, sport, parse, lg, selected); }, function (e) {
                failed++; global.TV.log("sports source: " + lg[0] + ": " + e.message); return [];
            }); })).then(function (lists) {
                if (failed && failed === list.length) throw new Error("Sports source unavailable");
                var seen = {}, matches = [];
                lists.forEach(function (items) { items.forEach(function (m) { if (!seen[m.id] && inSpan(m, from, to)) { seen[m.id] = true; matches.push(m); } }); });
                if (!failed) memo[key] = { at: now, list: matches };
                return matches;
            });
        }).catch(function (e) { if (old) return old.list; throw e; });
    }
    function clubTeams(slug, limited) {
        var year = new Date().getUTCFullYear();
        function fetch(path) { return limited(function () { return global.TV.fetchJSON(API + path, { timeout: 15000 }); }); }
        function get(y) {
            return season(slug, y, fetch).then(function (j) {
                var raw = (j.teams || []).slice();
                (j.events || []).forEach(function (e) { (e.competitions || []).forEach(function (c) { (c.competitors || []).forEach(function (x) { if (x.team) raw.push(x.team); }); }); });
                var seen = {};
                return raw.map(function (x) { var t = x.team || x; return { id: String(t.id || ""), name: t.displayName || t.name || "", short: t.shortDisplayName || t.abbreviation || t.displayName, logo: image(t.logo) || images(t) }; })
                    .filter(function (t) { if (!t.id || !t.name || seen[t.id]) return false; seen[t.id] = true; return true; });
            });
        }
        return get(year).catch(function () { return []; }).then(function (list) { return list.length ? list : get(year - 1); });
    }
    function inSpan(m, from, to) { return m.start < to && (m.start >= from || m.sport === "cricket" && m.end > from && m.state === "in"); }
    function compare(a, b) { var rank = function (m) { return m.state === "in" ? 0 : m.state === "pre" ? 1 : 2; }; return rank(a) - rank(b) || a.start - b.start || String(a.id).localeCompare(String(b.id)); }

    // Artwork is shared per event, cached on the TV and fetched below the free API's rate limit.
    var artCache = global.TV && global.TV.load ? global.TV.load("sportsEventArt", {}) || {} : {}, artPending = {}, artQueue = Promise.resolve();
    function artKey(m) { return m.sourceLeague + "/" + m.sourceEvent; }
    function artNow(m) {
        if (image(m.art)) return { u: m.art, by: "ESPN" };
        var bout = !m.isEvent && artCache[artKey(m) + "/" + m.id];
        if (bout && bout.u) return { u: bout.u, by: "TheSportsDB" };
        if (image(m.eventArt)) return { u: m.eventArt, by: "ESPN" };
        var c = artCache[artKey(m)]; return c ? c.u ? { u: c.u, by: "TheSportsDB" } : null : undefined;
    }
    function matchArtwork(j, m) {
        var number = /\bUFC\s*(\d+)\b/i.exec(m.eventTitle || ""), stamp = Date.parse(m.eventDate) || m.start;
        return (j.event || j.events || []).filter(function (x) {
            var dt = Date.parse(x.strTimestamp || x.dateEvent), sameDay = isFinite(dt) && Math.abs(dt - stamp) < 36 * 3600000;
            var other = /\bUFC\s*(\d+)\b/i.exec(x.strEvent || "");
            return sameDay && (number ? other && other[1] === number[1] : fold(x.strEvent).indexOf(fold(m.eventTitle)) >= 0 || fold(m.eventTitle).indexOf(fold(x.strEvent)) >= 0);
        })[0];
    }
    function eventArtwork(m) {
        var key = artKey(m), direct = image(m.art) || image(m.eventArt), old = artCache[key];
        if (direct) return Promise.resolve({ u: direct, by: "ESPN" });
        if (old && Date.now() - old.at < (old.u ? 7 * 86400000 : 6 * 3600000)) return Promise.resolve(old.u ? { u: old.u, by: "TheSportsDB" } : null);
        if (artPending[key]) return artPending[key];
        var number = /\bUFC\s*(\d+)\b/i.exec(m.eventTitle || ""), query = number ? "UFC_" + number[1] : m.eventTitle;
        var task = artQueue.then(function () { return global.TV.fetchJSON("https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e=" + encodeURIComponent(query), { timeout: 12000 }); });
        artQueue = task.catch(function () {}).then(function () { return new Promise(function (resolve) { global.setTimeout(resolve, 2100); }); });
        artPending[key] = task.then(function (j) {
            var x = matchArtwork(j, m), u = x && (image(x.strFanart) || image(x.strThumb) || image(x.strPoster));
            artCache[key] = { at: Date.now(), u: u || "" };
            var keys = Object.keys(artCache); if (keys.length > 250) delete artCache[keys[0]];
            if (global.TV.save) global.TV.save("sportsEventArt", artCache);
            return artNow(m);
        }, function () { return old && old.u ? { u: old.u, by: "TheSportsDB" } : null; }).then(function (result) { delete artPending[key]; return result; });
        return artPending[key];
    }
    function matchBoutArtwork(j, m) {
        return (j.event || j.events || []).filter(function (x) {
            var title = fold(x.strEvent), dt = Date.parse(x.strTimestamp || x.dateEvent), stamp = Date.parse(m.eventDate) || m.start;
            return isFinite(dt) && Math.abs(dt - stamp) < 36 * 3600000 && title.indexOf(fold(m.home.name)) >= 0 && title.indexOf(fold(m.away.name)) >= 0;
        })[0];
    }
    function artwork(m) {
        if (m.isEvent || image(m.art)) return eventArtwork(m);
        var key = artKey(m) + "/" + m.id, old = artCache[key];
        var parent = eventArtwork(m);
        if (old && Date.now() - old.at < (old.u ? 7 * 86400000 : 6 * 3600000)) return parent.then(function () { return artNow(m); });
        if (artPending[key]) return artPending[key];
        var query = m.home.name + "_vs_" + m.away.name;
        var task = artQueue.then(function () { return global.TV.fetchJSON("https://www.thesportsdb.com/api/v1/json/123/searchevents.php?e=" + encodeURIComponent(query), { timeout: 12000 }); });
        artQueue = task.catch(function () {}).then(function () { return new Promise(function (resolve) { global.setTimeout(resolve, 2100); }); });
        artPending[key] = Promise.all([parent, task.then(function (j) {
            var x = matchBoutArtwork(j, m), u = x && (image(x.strFanart) || image(x.strThumb) || image(x.strPoster));
            artCache[key] = { at: Date.now(), u: u || "" };
            if (global.TV.save) global.TV.save("sportsEventArt", artCache);
        }).catch(function () {})]).then(function () { delete artPending[key]; return artNow(m); });
        return artPending[key];
    }
    function card(m, api) {
        var TV = global.TV, el = TV.el, esc = TV.esc, c = el("div", "card mc mma-card"), art = el("div", "card__art mc__art"), cap = el("div", "mc__cap"), sub = el("div", "mc__sub");
        c.appendChild(art); c.appendChild(cap); c.appendChild(sub); c._m = m;
        var title = m.isEvent ? m.eventTitle : m.home.name + " vs " + m.away.name;
        c._update = function () {
            var st = api.status(m), ph = artNow(m);
            art.style.backgroundImage = ph ? 'linear-gradient(0deg,rgba(0,0,0,.75),transparent 70%),url("' + ph.u.replace(/"/g, "%22") + '")' : "linear-gradient(120deg,#202b48,#12141c)";
            art.innerHTML = "<span class='mma-card__brand'>" + esc(m.league[1]) + "</span><span class='mc__badge" + (st.live ? " is-live" : "") + "'>" + esc(st.text) + "</span>" +
                (!ph ? "<strong class='mma-card__title'>" + esc(title) + "</strong>" : "");
            cap.textContent = title;
            sub.textContent = m.isEvent ? (new Date(m.start).toLocaleDateString(TV.locale, { month: "short", day: "numeric" })) + " · " + m.bouts.length + " bouts" : m.note;
        };
        c._update(); artwork(m).then(function () { c._update(); });
        return c;
    }
    function openEvent(m, api) {
        var TV = global.TV, esc = TV.esc, el = TV.el, root = el("div", "mma-event"), scroll = el("div", "mma-event__scroll"), background = el("div", "mma-event__background"), nav, timer;
        root.appendChild(background); root.appendChild(scroll); document.body.appendChild(root);
        function close() { global.clearInterval(timer); root.remove(); TV.popNav(nav); }
        nav = new TV.Nav({ onSelect: function (i) { if (!i) close(); else api.openBout(nav.tiles[i]._m); }, onBack: close,
            onFocus: function (i, tile) { if (tile.scrollIntoView) tile.scrollIntoView({ block: "nearest" }); } });
        function paint() {
            var current = nav.current() && nav.current()._m, keep = nav.index, top = scroll.scrollTop;
            scroll.innerHTML = "";
            var back = el("div", "btn mma-event__back", esc(TV.t("Back"))), tiles = [back];
            scroll.appendChild(back);
            scroll.appendChild(el("div", "mma-event__promotion", esc(m.league[1])));
            scroll.appendChild(el("h1", "mma-event__title", esc(m.eventTitle)));
            scroll.appendChild(el("p", "mma-event__meta", esc(new Date(m.start).toLocaleString(TV.locale) + (m.venue ? " · " + m.venue : ""))));
            var bouts = m.bouts || [], sections = [], groups = {};
            bouts.forEach(function (bout) { var key = bout.cardSection || "Fight Card"; if (!groups[key]) { groups[key] = []; sections.push(key); } groups[key].push(bout); });
            sections.forEach(function (section) {
                scroll.appendChild(el("h2", "mma-event__section", esc(TV.t(section))));
                var grid = el("div", "mma-event__grid"); scroll.appendChild(grid);
                groups[section].forEach(function (bout) { var c = api.card(bout); grid.appendChild(c); tiles.push(c); });
            });
            if (!bouts.length) scroll.appendChild(el("p", "empty", esc(TV.t("Fight card not available yet."))));
            var at = current ? tiles.map(function (t) { return t._m && t._m.id; }).indexOf(current.id) : keep;
            nav.setTiles(tiles, Math.max(0, at)); scroll.scrollTop = top;
            artwork(m).then(function (p) { if (root.parentNode && p) background.style.backgroundImage = 'url("' + p.u.replace(/"/g, "%22") + '")'; });
        }
        paint(); TV.pushNav(nav);
        timer = global.setInterval(function () { if (TV.topNav() !== nav) return; var fresh = api.current(m.id); if (fresh) m = fresh; paint(); }, 30000);
    }
    global.APL_CUSTOM_SPORTS = { promotions: promotions, cricket: cricket, enhance: enhance, events: events, cricketSeries: cricketSeries,
        range: range, inSpan: inSpan, compare: compare, favTeam: favTeam, nationalTeams: nationalTeams, clubTeams: clubTeams,
        artNow: artNow, artwork: artwork, matchArtwork: matchArtwork, matchBoutArtwork: matchBoutArtwork, card: card, openEvent: openEvent };
})(window);
