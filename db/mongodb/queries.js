// Requêtes types du Lot 1 (catalogue) — MongoDB 8, base `ldlc`.
// Exécution : docker compose -p ldlc-nosql exec -T mongo mongosh ldlc --quiet -f /tmp/q.js
// Les écritures visent un produit/une catégorie temporaires (TEST-*) supprimés en fin de fichier.
db = db.getSiblingDB('ldlc');
const titre = (t) => print('\n=== ' + t + ' ===');

// 1. Filtre à facettes : CPU AM5, >= 8 cœurs, <= 600 EUR.
// Pattern Attribute : specs = [{k, v}]. $all + $elemMatch exige que k ET v portent sur le MÊME élément
// (sans $elemMatch, "socket" d'un élément et "AM5" d'un autre pourraient matcher). Prix en Decimal128.
titre('1. Facettes : CPU AM5, >= 8 coeurs, <= 600 EUR, tri prix');
db.products.find(
  { 'category._id': 'cpu', price: { $lte: NumberDecimal('600') },
    specs: { $all: [ { $elemMatch: { k: 'socket', v: 'AM5' } },
                     { $elemMatch: { k: 'cores', v: { $gte: 8 } } } ] } },
  { name: 1, price: 1 }
).sort({ price: 1 }).limit(20).forEach(printjson);

// 2. Fiche produit : une seule lecture par _id (SKU = clé naturelle). Le document contient déjà tout
// (extended references, rating calculé, 3 avis en subset, produits compatibles) : aucune jointure.
titre('2. Fiche produit par _id');
printjson(db.products.findOne({ _id: 'CPU-AMD-R7-9800X3D' },
  { name: 1, price: 1, brand: 1, category: 1, rating: 1, 'top_reviews.title': 1, 'compatible.sku': 1 }));

// 3. Avis paginés : la collection reviews porte tous les avis (le produit n'en garde que 3).
// L'index {product_id:1, created_at:-1} sert le filtre et le tri ; skip/limit = pagination par page.
titre('3. Avis paginés (page 1, 10 par page)');
db.reviews.find({ product_id: 'CPU-AMD-R7-9800X3D' }, { author: 1, rating: 1, title: 1, created_at: 1 })
  .sort({ created_at: -1 }).skip(0).limit(10).forEach(printjson);

// 4. Compteurs de facettes (panneau de filtres) : $unwind des specs puis regroupement par (k, v).
titre('4. Compteurs de facettes de la catégorie cpu');
db.products.aggregate([
  { $match: { 'category._id': 'cpu' } },
  { $unwind: '$specs' },
  { $group: { _id: { k: '$specs.k', v: '$specs.v' }, n: { $sum: 1 } } },
  { $sort: { '_id.k': 1, n: -1 } }
]).forEach(printjson);

// 5. Sous-arbre d'une catégorie : pattern Array of Ancestors. Une seule requête (index multiclé
// sur ancestors) renvoie tous les descendants de « composants », sans récursion.
titre('5. Sous-arbre de la catégorie composants');
db.categories.find({ ancestors: 'composants' }, { name: 1, parent: 1 }).sort({ _id: 1 }).forEach(printjson);

// 6. Ajout d'un avis (patterns Subset + Computed) sur un produit TEMPORAIRE.
// $inc et $push sur le même document sont atomiques ; $push avec $each/$sort/$slice garde les 3 avis
// les plus récents. La moyenne est une seconde écriture idempotente (recalculable).
titre("6. Ajout d'un avis (subset + computed) sur TEST-CPU-DEMO");
const now = new Date();
db.products.insertOne({
  _id: 'TEST-CPU-DEMO', name: 'Produit de test', slug: 'test-cpu-demo',
  category: { _id: 'cpu', name: 'Processeurs', path: 'informatique/composants/cpu' },
  brand: { _id: 'amd', name: 'AMD' }, price: NumberDecimal('1.00'),
  specs: [ { k: 'socket', label: 'Socket', v: 'AM5' } ],
  rating: { avg: 0, count: 0, sum: 0 }, top_reviews: [], schema_version: 1, created_at: now, updated_at: now });
for (const [i, note] of [[1, 5], [2, 4], [3, 3], [4, 5]]) {
  const r = { _id: new ObjectId(), product_id: 'TEST-CPU-DEMO', customer_id: 'C0001', author: 'Testeur',
              rating: note, title: 'Avis ' + i, comment: 'test', created_at: new Date(now.getTime() + i * 1000) };
  db.reviews.insertOne(r);
  const p = db.products.findOneAndUpdate({ _id: r.product_id },
    { $inc: { 'rating.count': 1, 'rating.sum': r.rating },
      $push: { top_reviews: { $each: [r], $sort: { created_at: -1 }, $slice: 3 } } },
    { returnDocument: 'after' });
  db.products.updateOne({ _id: p._id }, { $set: { 'rating.avg': p.rating.sum / p.rating.count } });
}
// Attendu : rating {count 4, sum 17, avg 4.25} ; top_reviews = Avis 4, 3, 2 (le plus ancien est évincé)
printjson(db.products.findOne({ _id: 'TEST-CPU-DEMO' }, { rating: 1, 'top_reviews.title': 1 }));
db.reviews.deleteMany({ product_id: 'TEST-CPU-DEMO' });
db.products.deleteOne({ _id: 'TEST-CPU-DEMO' });

// 7. Évolution sans migration : un nouvel attribut (specs dlss) et une nouvelle catégorie s'insèrent
// sans ALTER ni réécriture des documents existants (schéma ouvert, validateur en mode moderate).
titre('7. Évolution sans migration (nouvel attribut + nouvelle catégorie)');
db.categories.insertOne({ _id: 'test-vr', name: 'Casques VR', parent: 'peripheriques',
  ancestors: ['informatique', 'peripheriques'], facets: [ { k: 'refresh_rate', label: 'Fréquence' } ] });
db.products.insertOne({ _id: 'TEST-GPU-RTX5090', name: 'GPU de test avec DLSS', slug: 'test-gpu-rtx5090',
  category: { _id: 'gpu', name: 'Cartes graphiques', path: 'informatique/composants/gpu' },
  brand: { _id: 'nvidia', name: 'NVIDIA' }, price: NumberDecimal('2299.00'),
  specs: [ { k: 'dlss', label: 'DLSS', v: '4' } ], schema_version: 2, created_at: now, updated_at: now });
printjson(db.products.findOne({ _id: 'TEST-GPU-RTX5090' }, { specs: 1, schema_version: 1 }));
printjson(db.categories.findOne({ _id: 'test-vr' }, { name: 1, facets: 1 }));
db.products.deleteOne({ _id: 'TEST-GPU-RTX5090' });
db.categories.deleteOne({ _id: 'test-vr' });

// 8. explain() : la requête de facettes doit utiliser l'index {category._id, specs.k, specs.v}
// (IXSCAN) et non un parcours de collection (COLLSCAN).
titre('8. explain() de la requête de facettes');
const plan = db.products.find({ 'category._id': 'cpu', 'specs.k': 'socket', 'specs.v': 'AM5' }).explain('executionStats');
const wp = JSON.stringify(plan.queryPlanner.winningPlan);
print('étapes du plan : ' + wp.match(/"(IXSCAN|COLLSCAN|FETCH)"/g).join(' '));
print('index utilisé  : ' + wp.match(/"indexName":"([^"]+)"/)[1]);
print('docs examinés / retournés : ' + plan.executionStats.totalDocsExamined + ' / ' + plan.executionStats.nReturned);
