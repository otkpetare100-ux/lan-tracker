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

async function getRankedEntriesBySummonerId(summonerId) {
  const url = `${ENDPOINTS.LAN}/lol/league/v4/entries/by-summoner/${summonerId}`;
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
  if (!summoner || !summoner.id) throw new Error('Datos de invocador no encontrados');

  const ranked   = await getRankedEntriesBySummonerId(summoner.id);

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
    rank: soloQ ? formatRank(soloQ) : (flex ? formatRank(flex) : { tier: 'UNRANKED', rank: '', lp: 0, wins: 0, losses: 0 }),
    topChampions,
    matches:      [],
    streak:       0,
    mainPosition: '—',
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  };
}