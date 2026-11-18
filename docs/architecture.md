# Schéma d'architecture globale

```mermaid
flowchart TB
    subgraph CLIENTS["Clients"]
        WEB["Navigateur web"]
        MOB["App mobile"]
    end

    CDN["CDN<br/>images, assets"]
    LB["Load balancer<br/>HAProxy / NGINX"]

    API["<b>API / serveurs web stateless</b> (N instances)<br/>Catalogue · Panier / Session · Tracking · Recommandation"]

    CMD["Service Commandes / Paiement<br/>SGBD relationnel ACID existant<br/>(hors périmètre)"]

    REDIS[("<b>Lot 2 · Redis Cluster</b><br/>3 maîtres + 3 réplicas<br/>sessions, paniers (TTL glissant)<br/>cache fiches produit · AP")]
    MONGO[("<b>Lot 1 · MongoDB</b><br/>replica set 1 primaire + 2 secondaires<br/>products, categories, brands, reviews · CP")]
    NEO[("<b>Lot 4 · Neo4j</b><br/>cluster + read replicas<br/>produits, standards, clients · CP")]
    CASS[("<b>Lot 3 · Cassandra</b><br/>2 DC × 3 nœuds, RF=3<br/>événements, compteurs, top produits<br/>historique commandes · AP")]

    KAFKA{{"<b>Apache Kafka</b> (3 brokers)<br/>navigation-events · order-events · catalog-changes"}}
    SPARK["Jobs batch Spark<br/>top produits, BOUGHT_WITH"]

    WEB --> CDN
    WEB --> LB
    MOB --> LB
    LB --> API

    API -- "① fiche produit (cache)" --> REDIS
    API -- "① cache miss" --> MONGO
    API -- "② panier / session" --> REDIS
    API -. "③ clic / vue" .-> KAFKA
    API -- "④ commande" --> CMD
    CMD -. "④ order-events" .-> KAFKA
    API -- "⑤ recommandations" --> NEO
    MONGO -. "⑥ Change Streams" .-> KAFKA

    KAFKA -. "③ ④ ingestion analytics" .-> CASS
    KAFKA -. "④ ⑥ sync graphe" .-> NEO
    KAFKA -. "⑥ invalidation cache" .-> REDIS
    SPARK --> CASS
    SPARK --> NEO

    classDef mongo fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef redis fill:#ffebee,stroke:#c62828,color:#b71c1c
    classDef cass fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef neo fill:#ede7f6,stroke:#4527a0,color:#311b92
    classDef kafka fill:#37474f,stroke:#263238,color:#ffffff
    classDef ext fill:#f5f5f5,stroke:#9e9e9e,color:#616161,stroke-dasharray:5 5
    class MONGO mongo
    class REDIS redis
    class CASS cass
    class NEO neo
    class KAFKA kafka
    class CMD ext
```

Trait plein : appel synchrone. Pointillés : asynchrone (événements).

| Flux | Chemin |
|---|---|
| ① Fiche produit | API → cache Redis, sinon MongoDB (secondaire) |
| ② Panier / session | API ↔ Redis (TTL glissant, latence sub-ms) |
| ③ Clic / vue | API → Kafka `navigation-events` → Cassandra (asynchrone) |
| ④ Commande | API → service commandes → `order-events` → Cassandra (historique) + Neo4j (`PURCHASED`) |
| ⑤ Recommandations | API → Neo4j (read replicas) |
| ⑥ Évolution catalogue | Change Streams MongoDB → `catalog-changes` → Neo4j + invalidation du cache Redis |
