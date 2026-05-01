const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function test() {
    let KEY = process.env.RIOT_API_KEY;
    if (!KEY) return console.log('❌ No hay RIOT_API_KEY');
    KEY = KEY.replace(/\"/g, '').replace(/\'/g, '').trim();

    console.log(`🔍 Probando clave de 42 caracteres: ${KEY.substring(0, 10)}...`);

    // PRUEBA 1: Datos de cuenta (Usa americas)
    // Usamos una cuenta famosa de LAN para probar si la key sirve para algo
    const urlAccount = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Seiya/LAN`;
    
    try {
        console.log('📡 Prueba 1: Obteniendo PUUID real de Seiya#LAN...');
        const resAcc = await fetch(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Seiya/LAN`, { headers: { "X-Riot-Token": KEY } });
        
        if (resAcc.status === 200) {
            const dataAcc = await resAcc.json();
            const realPuuid = dataAcc.puuid;
            console.log(`✅ PUUID obtenido: ${realPuuid}`);

            console.log('📡 Prueba 2: Consultando Spectator (LAN) con PUUID real...');
            const urlSpec = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/${realPuuid}`;
            const resSpec = await fetch(urlSpec, { headers: { "X-Riot-Token": KEY } });
            
            console.log(`📊 Status Spectator: ${resSpec.status}`);
            
            if (resSpec.status === 404) {
                console.log('✅ ¡PRUEBA SUPERADA! La clave funciona con PUUIDs reales.');
                console.log('👉 El problema es que el jugador que estás rastreando tiene un PUUID mal guardado o es de otra región.');
            } else if (resSpec.status === 403) {
                console.log('❌ ERROR 403 PERSISTENTE: Riot prohíbe el Spectator a tu clave.');
                console.log('👉 Esto pasa si tu cuenta de Riot es muy nueva o no tienes un nivel mínimo en el LoL.');
            } else {
                console.log(`❓ Status inesperado: ${resSpec.status}`);
            }
        } else {
            console.log(`❌ No se pudo obtener el PUUID (Status ${resAcc.status})`);
        }
    } catch (e) {
        console.log('💥 Error:', e.message);
    }
}
test();
