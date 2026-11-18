// Exécuté une seule fois à l'initialisation du volume (mongosh).
db = db.getSiblingDB('ldlc');

// products : Polymorphic + Attribute (specs k/v) + Extended Reference (category, brand)
// + Computed (rating) + Subset (top_reviews). Schéma ouvert : champs additionnels autorisés,
// mode moderate pour laisser coexister les anciennes versions de schéma.
db.createCollection('products', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'category', 'brand', 'price'],
      properties: {
        name: { bsonType: 'string' },
        slug: { bsonType: 'string' },
        price: { bsonType: 'decimal' }, // Decimal128 : un double dérive sur les montants
        schema_version: { bsonType: 'int' },
        category: { bsonType: 'object', required: ['_id', 'name'] },
        brand: { bsonType: 'object', required: ['_id', 'name'] },
        stock: {
          bsonType: 'object',
          properties: { status: { enum: ['in_stock', 'low_stock', 'out_of_stock', 'preorder'] } }
        },
        specs: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['k', 'v'],
            properties: {
              k: { bsonType: 'string' },
              // valeur numérique jamais en chaîne avec unité : l'unité va dans u
              v: { bsonType: ['string', 'int', 'double', 'bool', 'decimal'] },
              u: { bsonType: 'string' }
            }
          }
        }
      }
    }
  },
  validationLevel: 'moderate',
  validationAction: 'error'
});

// categories : Array of Ancestors + facets typées { k, label, type, u? } ; brands ;
// reviews : tous les avis (référence product_id)
db.createCollection('categories');
db.createCollection('brands');
db.createCollection('reviews');

db.products.createIndex({ 'category._id': 1, price: 1 });
db.products.createIndex({ 'category._id': 1, 'specs.k': 1, 'specs.v': 1 }); // Attribute pattern
db.products.createIndex({ 'brand._id': 1 });
db.products.createIndex({ slug: 1 }, { unique: true });
db.products.createIndex({ name: 'text' }, { default_language: 'none' });
db.reviews.createIndex({ product_id: 1, created_at: -1 });
db.categories.createIndex({ ancestors: 1 });

// Jeu d'exemple minimal (celui du document de conception).
db.categories.insertMany([
  { _id: 'informatique', name: 'Informatique', parent: null, ancestors: [] },
  { _id: 'composants', name: 'Composants', parent: 'informatique', ancestors: ['informatique'] },
  { _id: 'cpu', name: 'Processeurs', parent: 'composants', ancestors: ['informatique', 'composants'],
    facets: [ { k: 'socket', label: 'Socket', type: 'string' }, { k: 'cores', label: 'Cœurs', type: 'number' },
              { k: 'tdp', label: 'TDP', type: 'number', u: 'W' } ] },
  { _id: 'logiciels', name: 'Logiciels', parent: 'informatique', ancestors: ['informatique'] },
  { _id: 'os', name: "Systèmes d'exploitation", parent: 'logiciels', ancestors: ['informatique', 'logiciels'],
    facets: [ { k: 'edition', label: 'Édition', type: 'string' }, { k: 'license', label: 'Licence', type: 'string' } ] }
]);
db.brands.insertMany([ { _id: 'amd', name: 'AMD' }, { _id: 'microsoft', name: 'Microsoft' } ]);
db.products.insertMany([
  { _id: 'CPU-AMD-R7-9800X3D', name: 'AMD Ryzen 7 9800X3D (4.7 GHz / 5.2 GHz)', slug: 'amd-ryzen-7-9800x3d',
    category: { _id: 'cpu', name: 'Processeurs', path: 'informatique/composants/cpu' },
    brand: { _id: 'amd', name: 'AMD' }, range: 'Ryzen 7', price: NumberDecimal('489.95'),
    stock: { status: 'in_stock', qty: 42 },
    specs: [ { k: 'socket', label: 'Socket', v: 'AM5' }, { k: 'cores', label: 'Cœurs', v: 8 },
             { k: 'tdp', label: 'TDP', v: 120, u: 'W' } ],
    compat: { uses: ['socket:AM5'], supports: [] },
    compatible: [ { sku: 'MB-MSI-X870-TOMAHAWK', name: 'MSI MAG X870 TOMAHAWK WIFI' } ],
    rating: { avg: 0, count: 0, sum: 0 }, top_reviews: [],
    schema_version: 1, created_at: new Date(), updated_at: new Date() },
  { _id: 'OS-MICROSOFT-WIN11-PRO', name: 'Microsoft Windows 11 Professionnel 64 bits', slug: 'windows-11-pro',
    category: { _id: 'os', name: "Systèmes d'exploitation", path: 'informatique/logiciels/os' },
    brand: { _id: 'microsoft', name: 'Microsoft' }, price: NumberDecimal('259.95'),
    stock: { status: 'in_stock', qty: 999 },
    specs: [ { k: 'edition', label: 'Édition', v: 'Professionnel' }, { k: 'license', label: 'Licence', v: 'ESD' } ],
    delivery: { mode: 'download', activation: 'clé numérique' },
    compat: { uses: [], supports: [] }, rating: { avg: 0, count: 0, sum: 0 }, top_reviews: [],
    schema_version: 1, created_at: new Date(), updated_at: new Date() }
]);
