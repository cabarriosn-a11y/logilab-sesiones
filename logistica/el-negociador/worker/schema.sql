-- El Negociador · esquema D1 (pegar en la consola de la base de datos)
CREATE TABLE IF NOT EXISTS salas (
  codigo  TEXT PRIMARY KEY,
  data    TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  creada  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS intentos (
  ip_hash TEXT NOT NULL,
  tipo    TEXT NOT NULL,
  creado  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intentos ON intentos(ip_hash, tipo, creado);
