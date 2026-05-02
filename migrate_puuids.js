const { MongoClient } = require('mongodb');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function migrate() {
    const MONGO_URI = process.env.MONGO_URI;
    const API_KEY = process.env.RIOT_API_KEY;

    if (!MONGO_URI || !API_KEY) {
        console.log('❌ Falta MONGO_URI o RIOT_API_KEY en el .env');
        return;
    }

    const client = new MongoClient(MONGO_URI);
    
    try {
        await client.connect();
        console.log('✅ Conectado a MongoDB');
        const db = client.db('lan-tracker');
        const accounts = await db.collection('accounts').find({}).toArray();

        console.log(`📝 Procesando ${accounts.length} cuentas...`);

        for (const acc of accounts) {
            console.log(`\n🔍 Verificando a: ${acc.gameName}#${acc.tagLine || 'LAN'}`);
            
            // Consultar PUUID real a Riot
            const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${acc.gameName}/${acc.tagLine || 'LAN'}`;
            const res = await fetch(url, { headers: { "X-Riot-Token": API_KEY.trim() } });

            if (res.ok) {
                const data = await res.json();
                const newPuuid = data.puuid;

                if (acc.puuid !== newPuuid) {
                    await db.collection('accounts').updateOne(
                        { _id: acc._id },
                        { $set: { puuid: newPuuid } }
                    );
                    console.log(`✅ ACTUALIZADO: El ID viejo ha sido reemplazado por el PUUID real.`);
                } else {
                    console.log(`⭐ YA ESTÁ BIEN: El PUUID ya era correcto.`);
                }
            } else {
                console.log(`⚠️ ERROR: No se pudo encontrar a este jugador en Riot (Status ${res.status}).`);
            }
        }

        console.log('\n✨ Migración finalizada con éxito.');
    } catch (e) {
        console.error('💥 Error durante la migración:', e.message);
    } finally {
        await client.close();
    }
}

migrate();
