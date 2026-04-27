/**
 * api.js — Riot Games API calls for LAN Tracker
 */

const BASE_PROXY = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/riot'
  : `${window.location.origin}/riot`;

const ENDPOINTS = {
  AMERICAS: 'https://americas.api.riotgames.com',
  LAN:      'https://la1.api.riotgames.com',
};

const DDRAGON_VERSION = '15.8.1';


async function riotFetch(url) {
  const proxyUrl = BASE_PROXY + '?url=' + url;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (data.status && data.status.status_code && data.status.status_code >= 400) {
    const err = new Error(`Riot API Error: ${data.status.status_code} ${data.status.message}`);
    err.status = data.status.status_code;
    throw err;
  }
  return data;
}

async function getAccountByRiotId(gameName, tagLine) {
  const url = `${ENDPOINTS.AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotFetch(url);
}

async function getSummonerByPuuid(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  return riotFetch(url);
}

async function getActiveGame(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/spectator/v5/active-games/by-puuid/${puuid}`;
  try {
    return await riotFetch(url);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function getRankedEntriesBySummonerId(summonerId) {
  const url = `${ENDPOINTS.LAN}/lol/league/v4/entries/by-summoner/${summonerId}`;
  return riotFetch(url);
}

async function getRankedEntriesByPuuid(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/league/v4/entries/by-puuid/${puuid}`;
  return riotFetch(url);
}

async function getTopMasteryChampions(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`;
  return riotFetch(url);
}

async function getMatchIds(puuid) {
  const url = `${ENDPOINTS.AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20`;
  return riotFetch(url);
}

async function getMatchDetail(matchId) {
  const url = `${ENDPOINTS.AMERICAS}/lol/match/v5/matches/${matchId}`;
  return riotFetch(url);
}

function getProfileIconUrl(iconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

window.FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

const POSITION_LABELS = {
  TOP:     'Top',
  JUNGLE:  'Jungla',
  MIDDLE:  'Mid',
  BOTTOM:  'ADC',
  UTILITY: 'Support',
  '':      '—',
};

let championDataCache = null;
async function getChampionData() {
  if (championDataCache) return championDataCache;
  const res  = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
  const data = await res.json();
  const map  = {};
  for (const champ of Object.values(data.data)) {
    map[String(champ.key)] = { name: champ.name, image: champ.image.full };
  }
  championDataCache = map;
  return map;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMatchHistory(puuid, onProgress) {
  try {
    const matchIds = await getMatchIds(puuid);
    if (!matchIds?.length) return { matches: [], streak: 0, mainPosition: '—' };
    
    const details = [];
    const total = matchIds.length;

    for (let i = 0; i < total; i++) {
      if (onProgress) onProgress(i + 1, total);
      const id = matchIds[i];
      await sleep(1200);
      try {
        const match = await getMatchDetail(id);
        const p = match.info.participants.find(x => x.puuid === puuid);
        if (!p) continue;
        
        details.push({
          champion: p.championName,
          win: p.win,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          gameDuration: match.info.gameDuration,
          cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
          damage: p.totalDamageDealtToChampions || 0,
          damageTaken: p.totalDamageTaken || 0,
          vision: p.visionScore || 0,
          gold: p.goldEarned || 0,
          kp: p.challenges?.killParticipation ? Math.round(p.challenges.killParticipation * 100) : 0,
          soloKills: p.challenges?.soloKills || 0,
          dmgObj: p.totalDamageDealtToObjectives || 0,
          dmgTurret: p.damageDealtToTurrets || 0,
          objStolen: p.objectivesStolen || 0,
          firstBlood: p.firstBloodKill || false,
          penta: p.pentaKills || 0,
          quadra: p.quadraKills || 0,
          killingSpree: p.largestKillingSpree || 0,
          goldDiff15: p.challenges?.goldDiffAt15 || 0,
          csDiff10: p.challenges?.maxCsAdvantageOnLaneOpponent || 0,
          consumables: p.consumablesPurchased || 0,
          position: p.teamPosition || ''
        });
      } catch(e) {
        console.warn('Error fetching match detail:', e);
        continue;
      }
    }

    let streak = 0;
    if (details.length > 0) {
      const first = details[0].win;
      for (const m of details) {
        if (m.win === first) streak++;
        else break;
      }
      streak = first ? streak : -streak;
    }

    const posCount = {};
    for (const m of details) {
      if (m.position) posCount[m.position] = (posCount[m.position] || 0) + 1;
    }
    const mainPos = Object.entries(posCount).sort((a,b) => b[1]-a[1])[0];
    const mainPosition = mainPos ? (POSITION_LABELS[mainPos[0]] || mainPos[0]) : '—';

    return { matches: details, streak, mainPosition };
  } catch(e) {
    console.error('Error in fetchMatchHistory:', e);
    return { matches: [], streak: 0, mainPosition: '—' };
  }
}

async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  if (!account || !account.puuid) throw new Error('Cuenta no encontrada en Riot');

  const summoner = await getSummonerByPuuid(account.puuid);
  if (!summoner) throw new Error('No se pudieron obtener los datos del invocador');

  let ranked = [];

  // Intento principal: Por PUUID (el más moderno y directo)
  try {
    ranked = await getRankedEntriesByPuuid(account.puuid);
  } catch (e) {
    console.warn('Fallo el intento por PUUID, iniciando rescate...');
    
    let rescueId = summoner.id;
    // RESCATE: Si no tenemos el id del invocador, lo buscamos en su última partida
    if (!rescueId) {
      try {
        const matchIds = await getMatchIds(account.puuid);
        if (matchIds && matchIds.length > 0) {
          const lastMatch = await getMatchDetails(matchIds[0]);
          const p = lastMatch.info.participants.find(x => x.puuid === account.puuid);
          if (p && p.summonerId) {
            rescueId = p.summonerId;
            console.log('✅ Rescate exitoso: ID recuperado del historial:', rescueId);
          }
        }
      } catch (errRescue) {
        console.warn('Fallo el rescate de ID por historial:', errRescue);
      }
    }

    if (rescueId) {
      try {
        ranked = await getRankedEntriesBySummonerId(rescueId);
      } catch (errRank) {
        console.warn('No se pudo obtener el rango por SummonerId:', errRank);
      }
    }
  }

  if (!ranked || ranked.length === 0) {
    console.warn('No se pudo obtener el rango por ningún método. El rango aparecerá como Unranked');
  }

  let topChampions = [];
  try {
    const mastery   = await getTopMasteryChampions(account.puuid);
    const champData = await getChampionData();
    topChampions = mastery.slice(0, 3).map(m => {
      const info = champData[String(m.championId)] || {};
      return {
        name:   info.name  || 'Unknown',
        image:  info.image || null,
        points: m.championPoints || 0,
        level:  m.championLevel  || 0
      };
    });
  } catch(e) {
    console.warn('No se cargaron campeones:', e);
  }

  const soloQ = ranked.find(r => r.queueType === 'RANKED_SOLO_5x5') || null;
  const flex  = ranked.find(r => r.queueType === 'RANKED_FLEX_SR')  || null;

  return {
    puuid:         account.puuid,
    gameName:      account.gameName,
    tagLine:       account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    soloQ: ranked.find(r => r.queueType === 'RANKED_SOLO_5x5') || null,
    flex:  ranked.find(r => r.queueType === 'RANKED_FLEX_SR') || null,
    topChampions,
    matches:      [],
    streak:       0,
    mainPosition: '—',
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  };
}