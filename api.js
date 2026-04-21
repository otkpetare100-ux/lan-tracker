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

async function getMatchIds(puuid) {
  // Ultimas 10 partidas de SoloQ (queue=420)
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

function getChampionIconUrl(championName) {
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${championName}.png`;
}

const FALLBACK_ICON_URL = `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/profileicon/29.png`;

const POSITION_LABELS = {
  TOP:     'Top',
  JUNGLE:  'Jungla',
  MIDDLE:  'Mid',
  BOTTOM:  'ADC',
  UTILITY: 'Support',
  '':      '—',
};

async function getMatchHistory(puuid) {
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
        });
      } catch(e) { continue; }
    }

    // Racha actual
    let streak = 0;
    if (details.length > 0) {
      const first = details[0].win;
      for (const m of details) {
        if (m.win === first) streak++;
        else break;
      }
      streak = first ? streak : -streak; // positivo = victorias, negativo = derrotas
    }

    // Posicion principal (la mas frecuente)
    const posCount = {};
    for (const m of details) {
      if (m.position) posCount[m.position] = (posCount[m.position] || 0) + 1;
    }
    const mainPos = Object.entries(posCount).sort((a,b) => b[1]-a[1])[0];
    const mainPosition = mainPos ? (POSITION_LABELS[mainPos[0]] || mainPos[0]) : '—';

    return { matches: details, streak, mainPosition };
  } catch(e) {
    console.warn('Error cargando historial:', e);
    return { matches: [], streak: 0, mainPosition: '—' };
  }
}

async function fetchAccountSnapshot(gameName, tagLine) {
  const account  = await getAccountByRiotId(gameName, tagLine);
  const summoner = await getSummonerByPuuid(account.puuid);
  const ranked   = await getRankedEntriesByPuuid(account.puuid);
  const history  = await getMatchHistory(account.puuid);

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
    matches:       history.matches,
    streak:        history.streak,
    mainPosition:  history.mainPosition,
    addedAt:       Date.now(),
    updatedAt:     Date.now(),
  };
}
