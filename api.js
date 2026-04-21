/**
 * api.js — Riot Games API calls for LAN Tracker
 */

const PROXY = 'http://localhost:3000/riot?url=';

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
  // NO encodeURIComponent aqui — el proxy recibe la URL limpia
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

function getProfileIconUrl(iconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/${iconId}.png`;
}

const FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const ranked   = await getRankedEntriesByPuuid(account.puuid);

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
    addedAt:       Date.now(),
  };
}
