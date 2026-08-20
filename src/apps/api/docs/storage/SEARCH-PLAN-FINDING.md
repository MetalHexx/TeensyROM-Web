# Search's Plan at Real Scale

**Captured:** 2026-08-18, after P02's composite index (`ix_file_identity` on `(storage_id, content_id)`)
landed. This document changes no query, index, or schema line — it records what the plan and live timings
show for `IndexSql.Search` as it stands today.

## What was measured, and how

`SqliteIndexStore.SearchAsync` was exercised against a database seeded from the real 64,658-file fixture
(`.local-fixtures/Sd-L5ZMCNBR.tsv`, device `L5ZMCNBR`, SD), through `IndexFixtureSeeder`, with
`SeedOptions(RunProjection: false)` — the exact seeding call `IndexStoreScenarios.RunAsync` makes
(`IndexStoreScenarios.cs:56-57`), not `SeededCollectionFixture`'s own default (`RunProjection: true`). The
deviation matters and is explained below.

The call shape mirrors `IndexStoreScenarios` exactly:
- Every `TeensyFileType` value (16, `Enum.GetValues<TeensyFileType>()` at `IndexStoreScenarios.cs:61`) — not
  just the launchable subset, since `SearchAsync` only falls back to `GetLaunchFileTypes()` when the caller
  passes zero types (`SqliteIndexStore.Reads.cs:85`), and the benchmark never does.
- Exclude paths: `StorageHelper.FavoritePaths` plus the playlist path — 7 distinct patterns on this
  collection (`/favorites/music/`, `/favorites/games/`, `/firmware/`, `/favorites/images/`,
  `/favorites/text/`, `/favorites/unknown/`, `/playlists/`).
- `limit: 200` (`IndexStoreScenarios.cs:30`).
- Search text: the first three characters of a real filename, found by the benchmark's own algorithm — a
  breadth-first walk from `/` for the first directory holding files, its first file (`IndexStoreScenarios.cs:79-83`).
  On this collection that file is `cart-tag.txt` at the root, so the term is `"car"`, and the FTS5 match
  expression `FtsQuery.Build` produces is `"car"*`.

Row counts after seeding: `file` = 64,658, `file_search` = 64,658, `content_search` = 0. `content_search` is
empty because `IndexFixtureSeeder.SeedAsync` only calls `MetadataProjection.ProjectAsync` when
`options.RunProjection` is true (`IndexFixtureSeeder.cs:113-120`), and the benchmark's own seed call passes
`false`. This is a fact about the *measurement*, not the store — see "A quirk in the benchmark's own setup"
below — and it does not change which access path the planner picks (that choice is static; see Suspect 1).

Every plan below is `EXPLAIN QUERY PLAN`'s own output, one row per line as `id|parent|notused|detail`,
pasted verbatim. Every timing is the median of 10 runs (an 11th warm-up run discarded), measured directly
against the seeded database (raw ADO.NET for the isolated statement shapes; through the real
`SqliteIndexStore.SearchAsync` surface for the "live" figure), on this machine — the plan is what travels to
another machine, the millisecond figures do not.

## The plan, captured

The statement is `IndexSql.Search(16, 7)`, bound with `$storage`, `$match = "car"*`, `$limit = 200`, all 16
`$type…` parameters, and all 7 `$exclude…` parameters (`IndexPathPatterns.ContainsPattern` over each exclude
path):

```sql
SELECT f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, $storageType AS storage_type,
m.title, m.creator, m.description, m.play_length, m.release_info,
m.metadata_source, m.metadata_source_path, m.share_url, m.meta1, m.meta2
  FROM file f LEFT JOIN content_metadata m ON m.content_id = f.content_id
 WHERE f.storage_id = $storage
   AND f.file_type IN ($type0, $type1, $type2, $type3, $type4, $type5, $type6, $type7, $type8, $type9, $type10, $type11, $type12, $type13, $type14, $type15)
   AND f.path NOT LIKE $exclude0 ESCAPE '\' AND f.path NOT LIKE $exclude1 ESCAPE '\' AND f.path NOT LIKE $exclude2 ESCAPE '\' AND f.path NOT LIKE $exclude3 ESCAPE '\' AND f.path NOT LIKE $exclude4 ESCAPE '\' AND f.path NOT LIKE $exclude5 ESCAPE '\' AND f.path NOT LIKE $exclude6 ESCAPE '\'
   AND ( f.id         IN (SELECT file_id    FROM file_search    WHERE file_search    MATCH $match)
      OR f.content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match) )
 ORDER BY f.name
 LIMIT $limit;
```

```
9|0|0|SEARCH f USING INDEX ix_file_type (storage_id=? AND file_type=?)
98|0|0|LIST SUBQUERY 1
100|98|0|SCAN file_search VIRTUAL TABLE INDEX 0:M3
118|0|0|LIST SUBQUERY 2
120|118|0|SCAN content_search VIRTUAL TABLE INDEX 0:M4
134|0|0|SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
172|0|0|USE TEMP B-TREE FOR ORDER BY
```

Live `SearchAsync` timings over this exact call shape, ms: `102.5, 105.2, 106.5, 108.4, 109.8, 114.8, 118.1,
122.0, 122.8, 139.3` — median **114.8 ms**, min 102.5 ms, max 139.3 ms, 200 results returned. This lands in
the same band as the benchmark's own reported 100.9 ms, which is the confirmation that this run reproduces
the scenario the benchmark measured, not a different one.

The driving row source is `ix_file_type (storage_id=?, file_type=?)` — **not** a bare `SCAN file`. But the
query asks for all 16 `TeensyFileType` values at once, so this index does not narrow anything: between its
16 sub-scans (one per `IN`-value) it visits every row belonging to the storage, the same row count a raw
table scan would. It differs from a table scan only in *how* those rows are visited (through the index's
B-tree, then a rowid lookup back into `file` for the columns the index doesn't carry) — not in how many.
`file_type IN (every value)` reads as selective; here it is not.

## Suspect 1 — the `OR` of two full-text subqueries

**Implicated, and the dominant cost.** The plan shows `LIST SUBQUERY 1`/`LIST SUBQUERY 2`: SQLite
materialises each `MATCH` subquery's result once into an ephemeral list, then probes both lists per row
visited by the outer `ix_file_type` scan. That is not SQLite's OR-optimisation (which would replace the scan
with a rowid union of two independent seeks) — it is the fallback: one shared, unselective driving scan with
two per-row membership checks layered on.

Isolating each branch (the `OR` and its other side removed, everything else — exclude clause, `ORDER BY`,
`LIMIT` — unchanged) shows why the fallback triggers:

```
-- f.id IN (SELECT file_id FROM file_search WHERE file_search MATCH $match) alone:
9|0|0|SEARCH f USING INDEX ix_file_type (storage_id=? AND file_type=? AND rowid=?)
72|0|0|LIST SUBQUERY 1
74|72|0|SCAN file_search VIRTUAL TABLE INDEX 0:M3
115|0|0|SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
155|0|0|USE TEMP B-TREE FOR ORDER BY
-- Timing: median 5.7 ms

-- f.content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match) alone:
9|0|0|SEARCH f USING INDEX ix_file_type (storage_id=? AND file_type=?)
98|0|0|LIST SUBQUERY 1
100|98|0|SCAN content_search VIRTUAL TABLE INDEX 0:M4
114|0|0|SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
152|0|0|USE TEMP B-TREE FOR ORDER BY
-- Timing: median 101.3 ms
```

The `f.id` branch is cheap **on its own**, and it stays cheap because SQLite folds `rowid = ?` into
*whichever* index it is already using for free — every rowid-table index carries the rowid implicitly, so
`ix_file_type (storage_id=?, file_type=?, rowid=?)` costs nothing extra to add. The `f.content_id` branch
gets no such gift: `content_id` is an ordinary column, present on `ix_file_identity (storage_id, content_id)`
but not on `ix_file_type`, and SQLite's planner — with no `ANALYZE` statistics for either table or the FTS5
subqueries feeding it — never switches off `ix_file_type` to reach it. This holds with or without the `OR`;
isolating the branch does not fix it, because the planner was never choosing `ix_file_identity` for it in the
first place. **P02's index made the fix possible; SQLite does not reach for it automatically.**

Pinning the branch the same way `IndexSql.IdentityMetadataJoin` already pins `ParentLookup`/`SiblingLookup`
(`IndexSql.cs:32-41`, `... file f INDEXED BY ix_file_identity ...`) confirms it:

```
-- f.content_id branch, INDEXED BY ix_file_identity:
9|0|0|SEARCH f USING INDEX ix_file_identity (storage_id=? AND content_id=?)
15|0|0|LIST SUBQUERY 1
17|15|0|SCAN content_search VIRTUAL TABLE INDEX 0:M4
114|0|0|SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
152|0|0|USE TEMP B-TREE FOR ORDER BY
-- Timing: median 0.1 ms
```

And the full candidate fix — a `UNION` of the two branches (the `f.id` side needs no hint; the `f.content_id`
side gets `INDEXED BY ix_file_identity`), then the same `LEFT JOIN`/`ORDER BY`/`LIMIT` the production
statement already has:

```sql
SELECT {FileColumns} FROM (
    SELECT f.id, f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, f.content_id
      FROM file f
     WHERE f.storage_id = $storage AND f.file_type IN (…) AND …exclude…
       AND f.id IN (SELECT file_id FROM file_search WHERE file_search MATCH $match)
    UNION
    SELECT f.id, f.name, f.path, f.size, f.file_type, f.is_favorite, f.is_compatible, f.content_id
      FROM file f INDEXED BY ix_file_identity
     WHERE f.storage_id = $storage AND f.file_type IN (…) AND …exclude…
       AND f.content_id IN (SELECT content_id FROM content_search WHERE content_search MATCH $match)
) f LEFT JOIN content_metadata m ON m.content_id = f.content_id
 ORDER BY f.name
 LIMIT $limit;
```

```
2|0|0|CO-ROUTINE f
3|2|0|COMPOUND QUERY
4|3|0|LEFT-MOST SUBQUERY
8|4|0|SEARCH f USING INDEX ix_file_type (storage_id=? AND file_type=? AND rowid=?)
71|4|0|LIST SUBQUERY 1
73|71|0|SCAN file_search VIRTUAL TABLE INDEX 0:M3
129|3|0|UNION USING TEMP B-TREE
132|129|0|SEARCH f USING INDEX ix_file_identity (storage_id=? AND content_id=?)
138|129|0|LIST SUBQUERY 3
140|138|0|SCAN content_search VIRTUAL TABLE INDEX 0:M4
269|0|0|SCAN f
272|0|0|SEARCH m USING INDEX sqlite_autoindex_content_metadata_1 (content_id=?) LEFT-JOIN
309|0|0|USE TEMP B-TREE FOR ORDER BY
-- Timing: median 6.4 ms
```

**113.0 ms → 6.4 ms**, roughly an 18× improvement, with no new index — `ix_file_identity` already exists
(P02). The cost is a query restructuring (`OR` → `UNION` plus one `INDEXED BY` pin) and the small constant
overhead a `UNION`'s deduplicating temp B-tree adds over a plain `OR`, which the numbers already include.

## Suspect 2 — `ORDER BY f.name` with no supporting index

**Implicated, but not independently — its cost rides on Suspect 1's driving scan.** `USE TEMP B-TREE FOR
ORDER BY` is present in every plan above. Removing only the `ORDER BY` (keeping the `OR`, the exclude clause,
and `LIMIT 200`) drops the full statement from median 113.0 ms to **59.2 ms**.

The mechanism is not sort cost — the file-name match itself is small (326 of 64,658 rows; see below), and
sorting a few hundred rows is not tens of milliseconds of work. It is that `ORDER BY` forces `LIMIT` to stop
being able to cut the scan short: with no required order, SQLite can stop the driving loop the moment it has
200 qualifying rows, wherever in the scan it finds them; with `ORDER BY f.name`, a later-visited row could
sort ahead of an already-found one, so SQLite must finish evaluating every candidate the driving scan offers
before it can be sure of the first 200 in `f.name` order. Since that driving scan is (per Suspect 1) close to
the whole storage, losing early-exit costs real time.

A composite index on `(storage_id, name)` would let the driving loop walk in `f.name` order directly, but it
would not, by itself, restore early-exit: the loop would still have to walk name-order rows filtering by
`OR`-membership as it goes, and with only 326 of 64,658 rows matching, it could still have to pass a large
fraction of the collection before collecting 200 matches, depending on where in the alphabet those 326 rows
fall. Weighed against that uncertain benefit is a write cost on every future indexed write, for a reader this
task's own measurement shows does not need it: once Suspect 1 is fixed, the driving set the sort runs over is
already small (the `UNION`'s row count, a few hundred on this collection), and `USE TEMP B-TREE FOR ORDER BY`
against a few hundred rows is negligible — the fixed candidate-fix timing above (6.4 ms) already includes
this sort. R1's reasoning — an index nothing uses is a write cost with no reader — cuts the other way once
Suspect 1 is fixed: this index would have no reader worth its write cost. **No index recommended here.**

## Suspect 3 — the exclude predicate (`f.path NOT LIKE '%…%'`)

**Implicated, but small in isolation and, like Suspect 2, riding on Suspect 1.** `NOT LIKE` with both a
leading and trailing wildcard has no index that can serve it — SQLite must materialise `f.path` and run a
substring search, and there is no line in any plan above naming an index for it; its cost is folded into
whichever driving scan visits the row. Removing the exclude clause entirely (keeping the `OR` and `ORDER
BY`) drops the full statement from median 113.0 ms to **37.4 ms** — seven unindexable substring checks,
run once per row the driving scan visits.

That cost is proportional to how many rows the driving scan visits, which is Suspect 1's fault, not this
predicate's: against the fixed `UNION` plan's few-hundred-row driving set, seven substring checks per row is
negligible. This is an inherent cost of the predicate's shape (nothing indexes a two-sided `LIKE`), but it is
not, on its own, what makes today's `Search` slow — it is expensive here only because Suspect 1 hands it
64,658 rows to run against instead of a few hundred.

## Weighing the workload

The specific term this run measured (`"car"*`) matched 326 of 64,658 files by name and 0 by content
(`content_search` is empty for the reason below) — a modest 0.5% hit rate, not the large fraction a bare
three-character prefix might suggest. The "very large hit set, sorted and truncated to 200" framing does not
hold for this particular term on this collection; a commoner three-letter prefix could of course match more,
but the mechanism identified above (an unselective driving scan feeding a small final result) does not depend
on the hit-set's size — it is present whether the final match count is 3 or 3,000, because it is the *driving*
scan (all 64,658 rows, via `ix_file_type`) that costs time, not the size of the set that survives it.

### A quirk in the benchmark's own setup

`IndexStoreScenarios.RunAsync` seeds with `RunProjection: false` (`IndexStoreScenarios.cs:56-57`), so the
100.9 ms the benchmark reports was measured against a database where `content_search` holds zero rows —
metadata projection never ran. That is a fact about the benchmark's setup, not a defect in `Search`: a
production index, seeded the normal way, projects metadata and populates `content_search` with real creator
and STIL text (see `SEARCH-ORACLE.md`). It does not change this finding's verdict, because the access-path
defect Suspect 1 identifies is a static planning decision — confirmed by the isolated `f.content_id` branch
above choosing `ix_file_type` over `ix_file_identity` regardless of whether `content_search` holds 0 rows or
many; SQLite has no `ANALYZE` statistics for either table to reason about the match count at all. A future
benchmark run seeded with real metadata would very likely measure this same defect, and could measure a
*larger* gap, since a non-empty `content_search` branch has actual rows to filter through the same
unselective scan rather than checking an always-empty list.

The legacy side's own shape is different in kind, not just cost: it is a linear scan with an unindexed
substring compare and no sort, over an in-memory structure it already holds resident. It is not doing "the
same work, done worse" — it is doing less total work per query (no full-text index materialisation, no
`ORDER BY`) against a structure paid for once at load time rather than per query. That asymmetry is real, but
it does not change this finding's verdict: the store's `Search` has a fixable, specific defect independent of
whatever the legacy comparison's own cost model looks like.

## Verdict: fixable

The dominant cost is Suspect 1: `Search`'s `OR` of two full-text subqueries falls back to an unselective
`ix_file_type` scan of the whole storage because SQLite's planner does not choose `ix_file_identity` for the
`f.content_id` branch on its own, even though P02 already built that index. Restructuring the `OR` into a
`UNION` of two branches — the `f.id` side unchanged, the `f.content_id` side pinned with
`INDEXED BY ix_file_identity` — measured **113.0 ms → 6.4 ms** (median, 10 runs) on this collection, using no
new index. Suspects 2 and 3 are genuine, but their cost is a multiplier on Suspect 1's driving scan rather
than an independent problem: fixing Suspect 1 already brings both down to negligible, and neither warrants an
index of its own today.

This task changes no query. The fix above is a candidate for a future task to implement and verify against
`SearchOracleTests` and the write-cost/query-plan test suites.
