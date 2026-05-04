/**
 * reset_db.js — Borra todo excepto 'splits' y 'economy'
 * Uso: node reset_db.js
 */
require('dotenv').config();
const { MongoClient } = require('mongodb');

const COLECCIONES_A_BORRAR = [
  'accounts',
  'rank_history',
  'activities',
  'bets',
  'challenges',
  'tournaments',
];

async function reset() {
  if (!process.env.MONGO_URI) {
    console.error('❌ Falta MONGO_URI en el .env');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('lan-tracker');

  console.log('🗑️  Iniciando reset (se conservan: splits, economy)...\n');

  for (const col of COLECCIONES_A_BORRAR) {
    try {
      const result = await db.collection(col).deleteMany({});
      console.log(`✅ ${col}: ${result.deletedCount} documentos eliminados`);
    } catch (e) {
      console.warn(`⚠️  ${col}: no existe o error →`, e.message);
    }
  }

  console.log('\n✔️  Reset completado. splits y economy intactos.');
  await client.close();
}

reset().catch(e => {
  console.error('❌ Error fatal:', e);
  process.exit(1);
});
