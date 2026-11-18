// Exécuté une seule fois à l'initialisation du volume (mongosh).
db = db.getSiblingDB('ldlc');

// products : Polymorphic + Attribute (specs k/v) + Extended Reference (category, brand)
// + Computed (rating) + Subset (top_reviews). Schéma ouvert : champs additionnels autorisés.
db.createCollection('products', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'category', 'brand', 'price'],
      properties: {
        name: { bsonType: 'string' },
        price: { bsonType: 'decimal' },
        category: { bsonType: 'object', required: ['_id', 'name'] },
        brand: { bsonType: 'object', required: ['_id', 'name'] },
        specs: {
          bsonType: 'array',
          items: { bsonType: 'object', required: ['k', 'v'] }
        }
      }
    }
  },
  validationLevel: 'moderate',
  validationAction: 'error'
});

// categories : Array of Ancestors ; brands ; reviews : tous les avis (référence product_id)
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
