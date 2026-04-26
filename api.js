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
  return res.json();
}

async function getAccountByRiotId(gameName, tagLine) {
  const url = `${ENDPOINTS.AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
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

async function getTopMasteryChampions(puuid) {
  const url = `${ENDPOINTS.LAN}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=3`;
  return riotFetch(url);
}

async function getMatchIds(puuid) {
  const url = `${ENDPOINTS.AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=5`;
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

async function fetchMatchHistory(puuid) {
  try {
    const matchIds = await getMatchIds(puuid);
    if (!matchIds || matchIds.length === 0) return { matches: [], streak: 0, mainPosition: '—' };

    const details = [];
    for (const id of matchIds) {
      try {
        const match = await getMatchDetail(id);
        const p     = match.info.participants.find(x => x.puuid === puuid);
        if (!p) continue;
        details.push({
          matchId:      id,
          champion:     p.championName,
          win:          p.win,
          kills:        p.kills,
          deaths:       p.deaths,
          assists:      p.assists,
          position:     p.teamPosition || p.individualPosition || '',
          gameDuration: match.info.gameDuration,
          cs:       (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
  damage:   p.totalDamageDealtToChampions || 0,
  vision:   p.visionScore || 0,
  gold:     p.goldEarned || 0,
  kp:       p.challenges && p.challenges.killParticipation ? Math.round(p.challenges.killParticipation * 100) : 0
});
      
      } catch(e) { continue; }
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
    return { matches: [], streak: 0, mainPosition: '—' };
  }
}

// Carga rapida — incluye top 3 campeones por maestria
async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const ranked   = await getRankedEntriesByPuuid(account.puuid);

  // Top 3 campeones por maestria
  let topChampions = [];
  try {
    const mastery   = await getTopMasteryChampions(account.puuid);
    const champData = await getChampionData();
    topChampions = mastery.slice(0, 3).map(m => {
      const info = champData[String(m.championId)] || {};
      return {
        name:   info.name  || 'Unknown',
        image:  info.image || null,
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
    soloQ,
    flex,
    topChampions,
    matches:      [],
    streak:       0,
    mainPosition: '—',
    addedAt:      Date.now(),
    updatedAt:    Date.now(),
  };
}