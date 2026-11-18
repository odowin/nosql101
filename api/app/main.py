from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app import analytics, cart, catalog
from app.db import cassandra_session, mongo_db, neo4j_driver, redis_client

app = FastAPI(
    title="API LDLC — prototype NoSQL polyglotte",
    description=(
        "Prototype de la refonte NoSQL de LDLC :\n\n"
        "- **Lot 1 — Catalogue** : MongoDB (documents polymorphes, specs clé/valeur, avis) + cache Redis\n"
        "- **Lot 2 — Paniers et sessions** : Redis (hashes avec TTL glissant)\n"
        "- **Lot 3 — Analytics et historique des commandes** : Cassandra (séries temporelles, compteurs)\n"
        "- **Lot 4 — Recommandations** : Neo4j (co-achats, compatibilité, filtrage collaboratif)"
    ),
)
app.include_router(catalog.router)
app.include_router(analytics.router)
app.include_router(cart.router)


@app.get("/health", tags=["Santé"])
def health():
    """Ping des 4 bases ; 503 si l'une d'elles ne répond pas."""
    checks = {
        "mongodb": lambda: mongo_db().command("ping"),
        "redis": lambda: redis_client().ping(),
        "cassandra": lambda: cassandra_session().execute("SELECT release_version FROM system.local"),
        "neo4j": lambda: neo4j_driver().verify_connectivity(),
    }
    status = {}
    for name, check in checks.items():
        try:
            check()
            status[name] = "ok"
        except Exception as e:
            status[name] = f"error: {e}"
    ok = all(v == "ok" for v in status.values())
    return JSONResponse(status, status_code=200 if ok else 503)
