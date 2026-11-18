"""Connexions aux 4 bases (clients créés à la demande puis mis en cache) et sérialisation JSON."""
import os
import time
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache

import redis
from bson import Decimal128, ObjectId
from cassandra.cluster import Cluster
from neo4j import GraphDatabase
from pymongo import MongoClient


@lru_cache
def mongo_db():
    return MongoClient(os.environ.get("MONGO_URI", "mongodb://mongo:27017"), tz_aware=True)["ldlc"]


@lru_cache
def redis_client():
    return redis.Redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"), decode_responses=True)


@lru_cache
def cassandra_session():
    # Cassandra démarre lentement : on réessaie jusqu'à ~3 min à la première connexion.
    hosts = os.environ.get("CASSANDRA_HOSTS", "cassandra").split(",")
    deadline = time.monotonic() + 180
    while True:
        try:
            return Cluster(hosts).connect("ldlc")
        except Exception:
            if time.monotonic() > deadline:
                raise
            time.sleep(5)


@lru_cache
def neo4j_driver():
    return GraphDatabase.driver(
        os.environ.get("NEO4J_URI", "bolt://neo4j:7687"),
        auth=(os.environ.get("NEO4J_USER", "neo4j"), os.environ.get("NEO4J_PASSWORD", "ldlc-password")),
    )


def to_json(obj):
    """Decimal128/Decimal → float, ObjectId → str, dates → ISO (récursif)."""
    if isinstance(obj, dict):
        return {k: to_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_json(v) for v in obj]
    if isinstance(obj, Decimal128):
        return float(obj.to_decimal())
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return obj
