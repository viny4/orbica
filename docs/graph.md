# Graph projection (local Neo4j)

A **derived, one-way projection** of the Postgres data into Neo4j, for exploring
relationships that are awkward in SQL: paths, shared components, clusters.

Postgres stays the source of truth. The graph is disposable — wipe and rebuild it
whenever. Nothing in the API, the web app, or the scheduled sync depends on it.

## Running it

Set these in `.env` (already supported by `src/config.py`):

```
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
NEO4J_DATABASE=rockets
```

```bash
cd services/pipeline
python -m src.graph.sync_neo4j --wipe      # clean rebuild (~20s)
python -m src.graph.sync_neo4j             # idempotent re-run (MERGE)
python -m src.graph.sync_neo4j --phase core
```

If `NEO4J_URI` is unset the command logs a warning and exits 0 — it must never
break a scripted run on a machine without a graph database.

Current size: **~36.8k nodes / ~132k relationships**, built in ~18s.

## Model

```
(Rocket)-[:IN_FAMILY]->(RocketFamily)-[:MANUFACTURED_BY]->(Agency)-[:BASED_IN]->(Country)
(Rocket)-[:POWERED_BY {stage, engine_count}]->(Engine)
(Launch)-[:USED_ROCKET]->(Rocket)
(Launch)-[:LAUNCHED_BY]->(Agency)
(Launch)-[:FROM_SITE]->(LaunchSite)-[:OPERATED_BY]->(Agency)
(Satellite)-[:DEPLOYED_ON]->(Launch)
(Satellite)-[:OPERATED_BY]->(Agency)
(Satellite)-[:MEMBER_OF]->(Constellation)
(Satellite)-[:IN_ORBIT]->(OrbitType)
(Satellite)-[:SERVES]->(Purpose)
(Satellite)-[:CLOSE_APPROACH {tca, miss_km, rel_speed_kms}]->(Satellite)
(Article)-[:MENTIONS]->(Rocket | Constellation)
(Session)-[:VIEWED {first_at, views}]->(Rocket | Satellite | Agency)
```

`tle_snapshots` is deliberately **not** loaded — it's a 44k-row time series with no
graph value. Keep querying it in Postgres.

## Two traps, learned the hard way

**1. `outcome` values are lowercase.** They are `success`, `failure`, `upcoming`,
`partial_failure`. `WHERE l.outcome = 'Failure'` silently returns zero failures
for every agency — a wrong answer, not an error.

**2. Dimension nodes are super-hubs.** `OrbitType {name:'LEO'}` has degree
**23,937**; `Purpose {name:'Communications'}` has 13,673. An unrestricted
`shortestPath` between any two satellites will route through them and return a
meaningless 2-hop path (`SatA -> LEO -> SatB`). For path queries, **restrict the
relationship types to structural edges**:

```cypher
MATCH p = shortestPath((a)-[:DEPLOYED_ON|USED_ROCKET|IN_FAMILY|MANUFACTURED_BY
                          |LAUNCHED_BY|OPERATED_BY|FROM_SITE*..8]-(b))
```

An empty result there is a real answer: the two satellites share no launch,
operator, or rocket lineage.

## Queries worth keeping

Failure rate by agency (excluding not-yet-flown launches):

```cypher
MATCH (l:Launch)-[:LAUNCHED_BY]->(a:Agency)
WHERE l.outcome IN ['success','failure','partial_failure']
WITH a, count(l) AS flown,
     sum(CASE WHEN l.outcome = 'failure' THEN 1 ELSE 0 END) AS failures
WHERE flown > 100
RETURN a.name AS agency, flown, failures, round(100.0*failures/flown,1) AS pct
ORDER BY pct DESC;
```

Engines reused across rocket families (supply-chain view):

```cypher
MATCH (f:RocketFamily)<-[:IN_FAMILY]-(:Rocket)-[:POWERED_BY]->(e:Engine)
WITH e, collect(DISTINCT f.name) AS families
WHERE size(families) > 1
RETURN e.name AS engine, size(families) AS families, families
ORDER BY families DESC;
```

Which rocket family has deployed the most distinct constellations:

```cypher
MATCH (c:Constellation)<-[:MEMBER_OF]-(:Satellite)-[:DEPLOYED_ON]->(:Launch)
      -[:USED_ROCKET]->(:Rocket)-[:IN_FAMILY]->(f:RocketFamily)
RETURN f.name AS family, count(DISTINCT c) AS constellations
ORDER BY constellations DESC;
```

Most conjunction-entangled satellites:

```cypher
MATCH (s:Satellite)-[c:CLOSE_APPROACH]-(:Satellite)
RETURN s.name, count(c) AS close_approaches, round(min(c.miss_km),3) AS closest_km
ORDER BY close_approaches DESC;
```

Analytics co-visitation — what else did people who viewed a rocket look at:

```cypher
MATCH (s:Session)-[:VIEWED]->(k:Rocket {slug:'falcon-9'})
MATCH (s)-[:VIEWED]->(other) WHERE other <> k
RETURN labels(other)[0] AS type, other.name AS also_viewed, count(*) AS sessions
ORDER BY sessions DESC;
```

> The analytics overlay is real but **thin**: it currently holds 57 sessions and
> only 11 entity page views. Co-visitation needs traffic to accumulate before it
> says anything.
