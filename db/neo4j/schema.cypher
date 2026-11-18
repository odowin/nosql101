// Contraintes d'unicité (créent aussi l'index associé)
CREATE CONSTRAINT product_sku IF NOT EXISTS FOR (p:Product) REQUIRE p.sku IS UNIQUE;
CREATE CONSTRAINT category_id IF NOT EXISTS FOR (c:Category) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT brand_id IF NOT EXISTS FOR (b:Brand) REQUIRE b.id IS UNIQUE;
CREATE CONSTRAINT range_name IF NOT EXISTS FOR (r:Range) REQUIRE r.name IS UNIQUE;
CREATE CONSTRAINT standard_id IF NOT EXISTS FOR (s:Standard) REQUIRE s.id IS UNIQUE;
CREATE CONSTRAINT customer_id IF NOT EXISTS FOR (c:Customer) REQUIRE c.id IS UNIQUE;
CREATE INDEX product_category IF NOT EXISTS FOR (p:Product) ON (p.category);
