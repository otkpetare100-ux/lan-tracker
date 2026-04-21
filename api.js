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

async function getChampionMastery(puuid) {
  // Top 5 campeones por maestria
  const url = `${ENDPOINTS.LAN}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=5`;
  return riotFetch(url);
}

function getProfileIconUrl(iconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

function getChampionIconUrl(championId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${championId}.png`;
}

const FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

// Cache de nombres de campeones
let championDataCache = null;

async function getChampionData() {
  if (championDataCache) return championDataCache;
  const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/data/es_MX/champion.json`);
  const data = await res.json();
  // Crea un mapa de id numerico -> {name, image}
  const map = {};
  for (const champ of Object.values(data.data)) {
    map[champ.key] = { name: champ.name, image: champ.image.full };
  }
  championDataCache = map;
  return map;
}

async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const ranked   = await getRankedEntriesByPuuid(account.puuid);

  let topChampions = [];
  try {
    const mastery   = await getChampionMastery(account.puuid);
    const champData = await getChampionData();
    topChampions = mastery.slice(0, 3).map(m => ({
      championId:    m.championId,
      championLevel: m.championLevel,
      championPoints: m.championPoints,
      name:  champData[String(m.championId)]?.name  || 'Desconocido',
      image: champData[String(m.championId)]?.image || null,
    }));
  } catch(e) {
    console.warn('No se pudieron cargar los campeones:', e);
  }

  const soloQ = ranked.find(r => r.queueType === 'RANKED_SOLO_5x5') || null;
  const flex  = ranked.find(r => r.queueType === 'RANKED_FLEX_SR')  || null;

  return {
    puuid:         account.puuid,
    gameName:      account.gameName,
    tagLine:       account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    soloQ,
    flex,
    topChampions,
    addedAt:       Date.now(),
    updatedAt:     Date.now(),
  };
}
