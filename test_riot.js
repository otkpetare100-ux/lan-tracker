require('dotenv').config();
const puuid = '2x9vB-eFvM5b4nS9_i2zN...'; // wait I need a real puuid.

async function test() {
  const key = process.env.RIOT_API_KEY;
  // Let's get an account puuid first.
  const r1 = await fetch(`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Nanami/LAN1?api_key=${key}`);
  const acc = await r1.json();
  console.log('Account:', acc);
  if(!acc.puuid) return;
  
  const r2 = await fetch(`https://la1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${acc.puuid}/top?count=3&api_key=${key}`);
  console.log('Top Mastery status:', r2.status);
  const m1 = await r2.json();
  console.log('Top Mastery data:', m1);

  const r3 = await fetch(`https://la1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${acc.puuid}?api_key=${key}`);
  console.log('All Mastery status:', r3.status);
  const m2 = await r3.json();
  console.log('All Mastery length:', m2.length);
}
test();
