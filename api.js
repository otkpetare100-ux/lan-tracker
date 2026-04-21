/**
 * api.js — Riot Games API calls for LAN Tracker
 */

const PROXY = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/riot?url='
  : `${window.location.origin}/riot?url=`;

const ENDPOINTS = {
  AMERICAS: 'https://americas.api.riotgames.com',
  LAN:      'https://la1.api.riotgames.com',
};

const DDRAGON_VERSION = '14.10.1';

async function riotFetch(url) {
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function getAccountByRiotId(gameName, tagLine) {
  const url = `${ENDPOINTS.AMERICAS}/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
  return riotFetch(url);
}

async function getSummonerByPuuid(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
  return riotFetch(url);
}

async function getRankedEntriesByPuuid(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/league/v4/entries/by-puuid/${puuid}`;
  return riotFetch(url);
}

// Trae las ultimas 20 partidas de SoloQ
async function getMatchHistory(puuid) {
  const url = `${ENDPOINTS.AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=20`;
  return riotFetch(url);
}

// Trae el detalle de una partida
async function getMatchDetail(matchId) {
  const url = `${ENDPOINTS.AMERICAS}/lol/match/v5/matches/${matchId}`;
  return riotFetch(url);
}

function getProfileIconUrl(iconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

const FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

// Cache de datos de campeones
let championDataCache = null;

async function getChampionData() {
  if (championDataCache) return championDataCache;
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
  const data = await res.json();
  const map = {};
  for (const champ of Object.values(data.data)) {
    map[champ.name] = { name: champ.name, image: champ.image.full, id: champ.key };
    map[champ.id]   = { name: champ.name, image: champ.image.full, id: champ.key };
  }
  championDataCache = map;
  return map;
}

// Calcula los 3 campeones mas jugados en las ultimas 20 partidas de SoloQ
async function getTopChampions(puuid) {
  try {
    const matchIds  = await getMatchHistory(puuid);
    if (!matchIds || matchIds.length === 0) return [];

    const champData = await getChampionData();

    // Cuenta partidas y victorias por campeon
    const stats = {};
    for (const matchId of matchIds) {
      try {
        const match      = await getMatchDetail(matchId);
        const participant = match.info.participants.find(p => p.puuid === puuid);
        if (!participant) continue;

        const champName = participant.championName;
        if (!stats[champName]) {
          stats[champName] = { games: 0, wins: 0 };
        }
        stats[champName].games++;
        if (participant.win) stats[champName].wins++;
      } catch(e) { continue; }
    }

    // Ordena por partidas jugadas y toma los top 3
    return Object.entries(stats)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 3)
      .map(([champName, s]) => {
        const info = champData[champName] || {};
        return {
          name:   champName,
          image:  info.image || null,
          games:  s.games,
          wins:   s.wins,
          losses: s.games - s.wins,
          wr:     Math.round((s.wins / s.games) * 100),
        };
      });
  } catch(e) {
    console.warn('No se pudo cargar historial:', e);
    return [];
  }
}

async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const ranked   = await getRankedEntriesByPuuid(account.puuid);

  const soloQ = ranked.find(r => r.queueType === 'RANKED_SOLO_5x5') || null;
  const flex  = ranked.find(r => r.queueType === 'RANKED_FLEX_SR')  || null;

  const topChampions = await getTopChampions(account.puuid);

  return {
    puuid:         account.puuid,
    gameName:      account.gameName,
    tagLine:       account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    soloQ,
    flex,
    topChampions,
    addedAt:   Date.now(),
    updatedAt: Date.now(),
  };
}
