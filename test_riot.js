const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function test() {
    let KEY = process.env.RIOT_API_KEY;
    
    if (!KEY) {
        console.log('❌ ERROR: No se encontró RIOT_API_KEY en el archivo .env');
        return;
    }

    // Limpiar posibles espacios o comillas accidentales
    KEY = KEY.replace(/\"/g, '').replace(/\'/g, '').trim();

    console.log(`🔑 Clave detectada: [${KEY.substring(0, 10)}...]`);
    console.log(`📏 Longitud: ${KEY.length} caracteres`);

    const url = `https://la1.api.riotgames.com/lol/spectator/v5/active-games/by-puuid/00000000-0000-0000-0000-000000000000`;
    
    try {
        const res = await fetch(url, {
            headers: { 
                "X-Riot-Token": KEY,
                "Accept": "application/json"
            }
        });
        
        console.log(`📊 RESPUESTA DE RIOT: ${res.status}`);
        
        if (res.status === 401) {
            console.log('❌ 401: Riot dice que NO enviaste ninguna clave o es totalmente inválida.');
        } else if (res.status === 403) {
            console.log('❌ 403: La clave llegó pero fue rechazada (caducada o de otra región).');
        } else if (res.status === 404) {
            console.log('✅ 404: ¡ÉXITO! La clave funciona correctamente.');
        } else {
            console.log(`❓ Status: ${res.status}`);
        }
    } catch (e) {
        console.log('💥 Error:', e.message);
    }
}

test();
