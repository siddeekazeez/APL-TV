/* Custom sports additions to Knikt's APL TV. MIT; see CUSTOMIZATIONS.md. */
(function (global) {
    "use strict";
    var API = "https://site.api.espn.com/apis/site/v2/", directory = null, directoryAt = 0, memo = {};
    var leagues = { mma: ["ufc", "UFC"], cricket: ["sri-lanka", "Sri Lanka Cricket", "i"] };
    function priority(m) { return m.sport === "mma" ? 0 : 1; }
    function enhance(f) {
        if (!f || f.skipped || f.customSportsVersion) return false;
        ["mma", "cricket"].forEach(function (s) {
            if (f.sports.indexOf(s) < 0) f.sports.push(s);
            var key = s + "/" + leagues[s][0];
            if (f.leagues.indexOf(key) < 0) f.leagues.push(key);
        });
        f.customSportsVersion = 1;
        return true;
    }
    function sriLanka(c) {
        var t = c.team || {};
        return /^(Sri Lanka|Sri Lanka Women)$/i.test(t.displayName || t.name || "");
    }
    function international(c) {
        return [1, 2, 3, 8, 9, 10].indexOf(Number((c.class || {}).internationalClassId)) >= 0;
    }
    function cricketSeries(j, from, to) {
        var year = new Date(from).getUTCFullYear();
        return (j.leagues || []).filter(function (l) {
            var s = l.season || {}, n = l.name || "", y = Number(s.year);
            return /^\d+$/.test(String(l.id)) && (!y || y >= year - 1 && y <= new Date(to).getUTCFullYear() + 1) &&
                (!s.endDate || Date.parse(s.endDate) >= from) &&
                /Sri Lanka|World (?:Test Championship|Cup)|Champions Trophy|Asia Cup/i.test(n) &&
                !/Under.?19|Youth|unofficial|Academy|A-Team|Sri Lanka A\b/i.test(n);
        });
    }
    function events(j, sport, parse) {
        var out = [];
        (j.events || []).forEach(function (e) {
            (e.competitions || []).forEach(function (c) {
                if (!c.competitors || c.competitors.length !== 2) return;
                if (sport === "cricket" && (!international(c) || !c.competitors.some(sriLanka))) return;
                var copy = {}, k;
                for (k in e) copy[k] = e[k];
                copy.competitions = [c];
                copy.id = sport === "mma" ? e.id + "-" + c.id : e.id;
                copy.date = c.date || e.date;
                copy.status = c.status || e.status;
                // ESPN's MMA competitors are athletes; the existing cards expect team-shaped objects.
                if (sport === "mma") {
                    var bout = {};
                    for (k in c) bout[k] = c[k];
                    bout.competitors = c.competitors.map(function (x, i) {
                        var a = x.athlete || {}, t = {}, key;
                        for (key in x) t[key] = x[key];
                        t.homeAway = i ? "away" : "home";
                        t.team = { id: x.id, displayName: a.displayName || a.fullName, shortDisplayName: a.shortName,
                            logo: (a.headshot || {}).href || (a.flag || {}).href || "" };
                        t.winner = x.winner === true || x.winner === "true";
                        return t;
                    });
                    copy.competitions = [bout];
                }
                var m = parse(copy, { id: sport }, leagues[sport]);
                if (!m) return;
                m.sourceEvent = String(e.id);
                m.sourceLeague = sport === "mma" ? "ufc" : String((j.leagues || [])[0] && j.leagues[0].id || "");
                m.end = Date.parse(c.endDate || e.endDate) || m.start;
                m.note = sport === "mma" ? e.name + (c.type && c.type.abbreviation ? " · " + c.type.abbreviation : "") : e.description || "";
                if (sport === "cricket") {
                    m.live = ((c.status || e.status || {}).type || {}).detail || "";
                    var home = c.competitors[0].homeAway === "away" ? c.competitors[1] : c.competitors[0];
                    var away = home === c.competitors[0] ? c.competitors[1] : c.competitors[0];
                    m.home.winner = home.winner === true || home.winner === "true";
                    m.away.winner = away.winner === true || away.winner === "true";
                }
                out.push(m);
            });
        });
        return out;
    }
    function date(t) { return new Date(t).toISOString().slice(0, 10).replace(/-/g, ""); }
    function range(sport, from, to, limited, parse) {
        var key = sport + "/" + from + "/" + to, old = memo[key], now = Date.now();
        if (old && now - old.at < (old.list.some(function (m) { return m.state === "in"; }) ? 30000 : 600000)) return Promise.resolve(old.list);
        function fetch(path) { return limited(function () { return global.TV.fetchJSON(API + path, { timeout: 20000 }); }); }
        var series;
        if (sport === "mma") series = Promise.resolve([{ id: "ufc" }]);
        else {
            if (!directory || now - directoryAt > 6 * 3600000) {
                directoryAt = now;
                directory = fetch("leagues/dropdown?region=us&lang=en&sport=cricket").catch(function (e) { directory = null; throw e; });
            }
            series = directory.then(function (j) { return cricketSeries(j, from - 7 * 86400000, to); });
        }
        return series.then(function (list) {
            var failed = 0;
            return Promise.all(list.map(function (l) {
                return fetch("sports/" + sport + "/" + l.id + "/scoreboard?dates=" + date(from - (sport === "cricket" ? 7 * 86400000 : 0)) + "-" + date(to - 1) + "&limit=500")
                    .then(function (j) { return events(j, sport, parse); }, function (e) {
                        failed++; global.TV.log("custom sports: " + l.id + ": " + e.message); return [];
                    });
            })).then(function (lists) {
                if (failed && failed === list.length) throw new Error("Sports source unavailable");
                var seen = {}, matches = [];
                lists.forEach(function (items) { items.forEach(function (m) {
                    if (!seen[m.id]) { seen[m.id] = true; matches.push(m); }
                }); });
                // Partial failures are retried next refresh instead of cached as a complete response.
                if (!failed) memo[key] = { at: now, list: matches };
                return matches;
            });
        }).catch(function (e) { if (old) return old.list; throw e; });
    }
    function inSpan(m, from, to) {
        return m.start < to && (m.start >= from || m.sport === "cricket" && m.end > from && m.state === "in");
    }
    global.APL_CUSTOM_SPORTS = { leagues: leagues, enhance: enhance, priority: priority, events: events,
        cricketSeries: cricketSeries, range: range, inSpan: inSpan };
})(window);
