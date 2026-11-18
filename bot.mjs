import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Ошибка: не задан GEMINI_API_KEY');
  process.exit(1);
}

const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const existingTitles = articles.slice(0, 40).map(a => a.title).join(' | ');

const ALL_CATEGORIES = ['ПК и Консоли', 'Инди', 'Киберспорт', 'Обзоры', 'Индустрия'];

// Выбираем целевую рубрику, которой давно не было в последних публикациях
function pickTargetCategory() {
  const recentCategories = articles.slice(0, 4).map(a => a.category);
  const missing = ALL_CATEGORIES.filter(cat => !recentCategories.includes(cat));
  if (missing.length > 0) {
    return missing[Math.floor(Math.random() * missing.length)];
  }
  const counts = Object.fromEntries(ALL_CATEGORIES.map(c => [c, 0]));
  for (const a of articles) {
    if (counts[a.category] !== undefined) counts[a.category]++;
  }
  return ALL_CATEGORIES.sort((a, b) => counts[a] - counts[b])[0];
}

const TARGET_CATEGORY = pickTargetCategory();

const RSS_FEEDS = [
  'https://www.videogameschronicle.com/feed/',
  'https://www.eurogamer.net/feed',
  'https://www.pcgamer.com/rss/',
  'https://feeds.feedburner.com/ign/games-all',
  'https://www.gamespot.com/feeds/game-news/',
  'https://www.rockpapershotgun.com/feed',
  'https://www.gematsu.com/feed',
  'https://insider-gaming.com/feed/',
  'https://www.polygon.com/rss/index.xml',
  'https://kotaku.com/rss',
  'https://www.gamesradar.com/rss/',
  'https://www.dsogaming.com/feed/',
  'https://wccftech.com/feed/',
  'https://www.tomshardware.com/feeds/all',
  'https://www.techpowerup.com/rss/news',
  'https://dotesports.com/feed',
  'https://www.hltv.org/rss/news',
  'https://indiegamesplus.com/feed'
];

const SOURCES_BASE = {
  studios_20: [
    'rockstargames.com', 'cdprojektred.com', 'fromsoftware.jp', 'naughtydog.com',
    'larian.com', 'bethesda.net', 'insomniac.games', 'capcom.com', 'valvesoftware.com',
    'blizzard.com', 'ubisoft.com', 'ea.com', 'square-enix-games.com', 'kojimaproductions.jp',
    'remedygames.com', 'obsidian.net', 'riotgames.com', 'epicgames.com', 'bungie.net',
    '2k.com'
  ],
  gaming_media_50: [
    'ign.com', 'gamespot.com', 'pcgamer.com', 'eurogamer.net', 'polygon.com',
    'kotaku.com', 'videogameschronicle.com', 'gamesradar.com', 'rockpapershotgun.com',
    'vg247.com', 'gamesindustry.biz', 'gamedeveloper.com', 'gematsu.com', 'destructoid.com',
    'escapistmagazine.com', 'shacknews.com', 'thegamer.com', 'pcgamesn.com', 'pushsquare.com',
    'purexbox.com', 'nintendolife.com', 'dexerto.com', 'insider-gaming.com', 'dsogaming.com',
    'wccftech.com', 'digitaltrends.com/gaming', 'windowscentral.com/gaming', 'tweaktown.com',
    'venturebeat.com/games', 'arstechnica.com/gaming', 'theverge.com/games', 'wired.com/tag/video-games',
    'dualshockers.com', 'siliconera.com', 'rpgsite.net', 'mmorpg.com', 'massivelyop.com',
    'steamdb.info', 'howlongtobeat.com', 'metacritic.com', 'opencritic.com', 'dtf.ru',
    'stopgame.ru', 'igromania.ru', 'ixbt.games', 'playground.ru', 'kanobu.ru',
    'cybersport.ru', 'hltv.org', 'liquipedia.net', 'dotesports.com', 'indiegamesplus.com'
  ],
  hardware_vendors: [
    'nvidia.com', 'amd.com', 'intel.com', 'asus.com/rog', 'msi.com',
    'gigabyte.com', 'corsair.com', 'razer.com', 'logitechg.com', 'steelseries.com',
    'hyperx.com', 'samsung.com/semiconductor', 'kingston.com', 'western-digital.com',
    'tomshardware.com', 'techpowerup.com', 'anandtech.com', 'digitalfoundry.net'
  ],
  x_accounts: [
    'x.com/geoffkeighley', 'x.com/jasonschreier', 'x.com/TomHenderson_', 'x.com/shinobi602',
    'x.com/Wario64', 'x.com/SteamDB', 'x.com/RockstarGames', 'x.com/CDPROJEKTRED',
    'x.com/HIDEO_KOJIMA_EN', 'x.com/SwenVincke', 'x.com/Neil_Druckmann', 'x.com/PhilSpencer',
    'x.com/PlayStation', 'x.com/Xbox', 'x.com/NintendoAmerica', 'x.com/NVIDIAGeForce',
    'x.com/AMDRadeon', 'x.com/IntelGaming', 'x.com/IGN', 'x.com/VGC_News'
  ]
};

// Легальные обложки корпораций и платформ (CC0 / Unsplash) для судов, магазинов и консолей
const PLATFORM_COVERS = {
  playstation: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
  xbox: '
