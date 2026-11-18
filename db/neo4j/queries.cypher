// Requêtes types du Lot 4 (recommandations) — Neo4j 5.26. Valeurs littérales (pas de paramètres :param).
// Exécution : docker compose -p ldlc-nosql exec -T neo4j cypher-shell -u neo4j -p ldlc-password < db/neo4j/queries.cypher
// Lecture seule : aucune donnée n'est modifiée.

// 1. « Ont aussi acheté » : 2 sauts via les clients (Product <-PURCHASED- Customer -PURCHASED-> Product).
// On compte les acheteurs distincts ; le filtre de catégorie optionnel (ici : cartes mères) s'applique tôt,
// grâce à la propriété category dénormalisée sur Product.
MATCH (p:Product {sku: 'CPU-AMD-R7-9800X3D'})<-[:PURCHASED]-(c:Customer)-[:PURCHASED]->(o:Product)
WHERE o <> p AND o.category = 'motherboard'
RETURN o.sku AS sku, o.name AS name, count(DISTINCT c) AS buyers ORDER BY buyers DESC LIMIT 5;

// 2. Achetés ensemble : relation BOUGHT_WITH pré-calculée (compteur sur l'arête), lecture en 1 saut.
// Évite de reparcourir tous les achats d'un best-seller (parade au supernœud) ; le sens est ignoré.
MATCH (:Product {sku: 'CPU-AMD-R7-9800X3D'})-[r:BOUGHT_WITH]-(o:Product)
RETURN o.sku AS sku, o.name AS name, r.count AS fois ORDER BY fois DESC LIMIT 5;

// 3. Compatibles avec ce boîtier : pattern Standard. A est compatible avec B s'ils partagent un nœud
// Standard avec des types d'arête différents (USES d'un côté, SUPPORTS de l'autre) ; type(r1) <> type(r2)
// écarte deux produits qui font tous deux « SUPPORTS socket:AM5 » (ex. carte mère et ventirad).
MATCH (a:Product {sku: 'CASE-NZXT-H5-FLOW'})-[r1:USES|SUPPORTS]->(s:Standard)<-[r2:USES|SUPPORTS]-(b:Product)
WHERE type(r1) <> type(r2)
RETURN b.category AS categorie, b.sku AS sku, b.name AS name, collect(s.id) AS via ORDER BY categorie, sku;

// 4. Similaires : même catégorie ; score = 2 x marque commune + 3 x gamme commune + standards communs.
// OPTIONAL MATCH garde les candidats sans marque/gamme/standard en commun (score 0 pour ce critère).
MATCH (p:Product {sku: 'CPU-AMD-R7-9800X3D'})-[:IN_CATEGORY]->(:Category)<-[:IN_CATEGORY]-(o:Product) WHERE o <> p
OPTIONAL MATCH (p)-[:MADE_BY]->(b)<-[:MADE_BY]-(o)
OPTIONAL MATCH (p)-[:IN_RANGE]->(r)<-[:IN_RANGE]-(o)
OPTIONAL MATCH (p)-[:USES|SUPPORTS]->(s:Standard)<-[:USES|SUPPORTS]-(o)
WITH p, o, 2 * count(DISTINCT b) + 3 * count(DISTINCT r) + count(DISTINCT s) AS score
RETURN o.sku AS sku, o.name AS name, score ORDER BY score DESC, abs(o.price - p.price) LIMIT 5;

// 5. Filtrage collaboratif personnalisé (3 sauts, « amis d'amis ») pour le client C0001 :
// produits achetés par des clients qui ont acheté comme lui, et qu'il ne possède pas encore.
MATCH (me:Customer {id: 'C0001'})-[:PURCHASED]->(:Product)<-[:PURCHASED]-(peer:Customer)-[:PURCHASED]->(reco:Product)
WHERE peer <> me AND NOT (me)-[:PURCHASED]->(reco)
RETURN reco.sku AS sku, reco.name AS name, count(DISTINCT peer) AS score ORDER BY score DESC LIMIT 5;

// 6. Exploration : degré du supernœud socket:AM5 (nombre d'arêtes entrantes, par type).
// Un tel nœud relie tous les CPU, cartes mères et ventirads AM5 : les parcours qui le traversent sans
// filtre explosent, d'où le pré-calcul BOUGHT_WITH et le filtrage précoce par catégorie.
MATCH (s:Standard {id: 'socket:AM5'})<-[r]-()
RETURN s.id AS standard, type(r) AS relation, count(r) AS degre ORDER BY degre DESC;

// 7. Plus court chemin entre deux produits : un CPU et une RAM, via les seuls standards de compatibilité
// (on exclut PURCHASED/BOUGHT_WITH, sinon le chemin direct d'achat conjoint gagne). Résultat attendu :
// CPU -> socket:AM5 -> carte mère -> memory:DDR5 -> RAM (4 sauts) : la chaîne de compatibilité.
MATCH (a:Product {sku: 'CPU-AMD-R7-9800X3D'}), (b:Product {sku: 'RAM-CORSAIR-VENGEANCE-32-6000'})
MATCH path = shortestPath((a)-[:USES|SUPPORTS*..6]-(b))
RETURN [n IN nodes(path) | coalesce(n.sku, n.id, n.name)] AS chemin, length(path) AS sauts;

// 8. Volumétrie du graphe : nombre de nœuds par label.
MATCH (n) RETURN labels(n)[0] AS label, count(*) AS noeuds ORDER BY noeuds DESC;
