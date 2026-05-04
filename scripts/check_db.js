const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('lan-tracker');
  const acc = await db.collection('accounts').findOne();
  console.log(JSON.stringify(acc, null, 2));
  process.exit(0);
}
run();
