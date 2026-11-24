import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Ошибка: не задан GEMINI_API_KEY');
  process.exit(1);
}

const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const recentArticles = articles.slice(0, 35);
const existingSummaries = recentArticles
  .map(a => `«${a.title}» [теги: ${(a.tags || []).join(', ')}] — ${(a.excerpt || '').slice(0, 120)}`)
  .join('\n- ');
const recentImages = new Set(articles.slice(0, 15).map(a => a.image).filter(Boolean));

const ALL_CATEGORIES = ['ПК и Консоли', 'Инди', 'Киберспорт', 'Новинки и резонанс', 'Индустрия'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Определяем рубрики, которых не было в последних 3 публикациях (для мягкого баланса)
function getPreferredCategories() {
  const recentCategories = articles.slice(0, 3).map(a => a.category);
  const fresh = ALL_CATEGORIES.filter(cat => !recentCategories.includes(cat));
  return fresh.length > 0 ? fresh : ALL_CATEGORIES;
}

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

// Наборы легальных обложек по платформам (CC0 / Unsplash)
const PLATFORM_COVERS = {
  playstation: [
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1607853202273-797f1c22a38e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1622297845775-5ff3fef71d13?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1592155931584-901ac15763e3?auto=format&fit=crop&w=1200&q=80'
  ],
  xbox: [
    'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1605901309584-818e25960a8f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&w=1200&q=80'
  ],
  nintendo: [
    'https://images.unsplash.com/photo-1578303512597-81e6cc155b3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1585857188892-938297272031?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1617096200347-cb04ae810b1d?auto=format&fit=crop&w=1200&q=80'
  ],
  steam: [
    'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80'
  ],
  hardware: [
    'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1555617981-dac3880eac6e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
  ]
};

// Наборы легальных стоковых обложек по рубрикам (CC0 / Unsplash)
const LEGAL_FALLBACK_COVERS = {
  'ПК и Консоли': [
    'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=80'
  ],
  'Инди': [
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=1200&q=80'
  ],
  'Киберспорт': [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598550476439-6847785fcea6?auto=format&fit=crop&w=1200&q=80'
  ],
  'Новинки и резонанс': [
    'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1580327344181-c1163234e5a0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'
  ],
  'Индустрия': [
    'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80'
  ]
};

function pickUnusedCover(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const unused = pool.filter(url => !recentImages.has(url));
  const candidates = unused.length > 0 ? unused : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  return fetch(url, {
    ...options,
    signal: options.signal || AbortSignal.timeout(timeoutMs)
  });
}

// Фиксированный порядок моделей под лимиты Free tier: сначала 500 RPD, затем 20 RPD в резерв
async function getAvailableModels() {
  return [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash'
  ];
}

// Парсим свежие заголовки и факты из RSS
async function fetchFreshRssNews() {
  const items = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetchWithTimeout(feedUrl, {
        headers: { 'User-Agent': 'BUGROVGAMES-Bot/1.0' }
      }, 8000);
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 4);
      for (const m of matches) {
        const block = m[1];
        const title = (
          block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
          block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ||
          ''
        ).trim();
        const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
        const desc = (
          block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ||
          block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
          ''
        )
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 400);

        if (title) {
          items.push(`- [${new URL(feedUrl).hostname}] ${title} | URL: ${link} | ${desc}`);
        }
      }
    } catch (_) {}
  }
  return items.slice(0, 50).join('\n');
}

// Поиск официальных HD-скриншотов, hero-арта или обложки игры в Steam Store API
async function findSteamCover(gameTitle) {
  if (!gameTitle || gameTitle.toLowerCase() === 'none') return null;
  try {
    const cleanTitle = gameTitle.trim();
    const query = encodeURIComponent(cleanTitle);
    const res = await fetchWithTimeout(
      `https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=US`,
      {},
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const apps = (data.items || []).filter(item => item.type === 'app');
    if (!apps.length) return null;

    const lowerTarget = cleanTitle.toLowerCase();
    const match =
      apps.find(item => item.name.toLowerCase() === lowerTarget) ||
      apps.find(item => item.name.toLowerCase().includes(lowerTarget)) ||
      apps[0];

    if (!match || !match.id) return null;

    // 1. Пробуем забрать официальные HD-скриншоты (1920x1080) со страницы игры
    try {
      const detailsRes = await fetchWithTimeout(
        `https://store.steampowered.com/api/appdetails?appids=${match.id}&cc=US&l=english`,
        {},
        8000
      );
      if (detailsRes.ok) {
        const detailsJson = await detailsRes.json();
        const appData = detailsJson?.[String(match.id)]?.data;
        const screenshots = (appData?.screenshots || [])
          .map(s => s.path_full?.split('?')[0])
          .filter(Boolean);

        if (screenshots.length > 0) {
          const unusedShots = screenshots.filter(url => !recentImages.has(url));
          const pool = unusedShots.length > 0 ? unusedShots : screenshots;
          return pool[Math.floor(Math.random() * pool.length)];
        }
      }
    } catch (_) {}

    // 2. Широкоформатный library_hero.jpg
    const heroUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${match.id}/library_hero.jpg`;
    const heroCheck = await fetchWithTimeout(heroUrl, { method: 'HEAD' }, 6000);
    if (heroCheck.ok && !recentImages.has(heroUrl)) return heroUrl;

    // 3. Запасной header.jpg
    const headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${match.id}/header.jpg`;
    const headerCheck = await fetchWithTimeout(headerUrl, { method: 'HEAD' }, 6000);
    if (headerCheck.ok) return headerUrl;
  } catch (_) {}
  return null;
}

function buildPrompt(rssContext, preferredCategories, rejectedTopics = []) {
  return `Ты — выпускающий редактор и ведущий аналитик игрового медиапортала BUGROVGAMES.
Твоя задача — выбрать САМЫЙ ГОРЯЧИЙ, СВЕЖИЙ И ОБСУЖДАЕМЫЙ инфоповод за последние 24–48 часов из всей игровой индустрии и написать по нему ОДИН сильный материал.

КАК ВЫБРАТЬ ТЕМУ И РУБРИКУ:
1. Главный критерий — масштаб и свежесть события (громкий анонс, неожиданный релиз, крупный скандал/резонанс, рекорды онлайна, высокие/провальные оценки критиков и игроков, важный патч, громкая сделка или железный анонс).
2. Подбери одну точную рубрику из списка:
   - «ПК и Консоли» — крупные релизы, анонсы, трейлеры, переносы или обновления для ПК, PlayStation, Xbox и Nintendo Switch;
   - «Инди» — яркие инди-хиты из Steam, релизы от независимых студий, неожиданные прорывы в раннем доступе;
   - «Киберспорт» — только действительно крупные финалы турниров, громкие решафлы или важные патчи в CS2, Dota 2, LoL, Valorant (НЕ выдумывай и не бери мелкие слухи, если в киберспорте затишье);
   - «Новинки и резонанс» — разбор свежих стартов и громких релизов: оценки на Metacritic/OpenCritic, отзывы игроков в Steam, рекорды пикового онлайна, технические проблемы или споры;
   - «Индустрия» — бизнес, отчёты продаж, сделки студий, увольнения, суды, игровое железо (NVIDIA, AMD, Intel).
3. Мягкий приоритет (при равной громкости новостей): ${preferredCategories.join(', ')} (этих рубрик не было в последних 3 публикациях, но если в другой рубрике есть объективно более горячая новость — смело бери её).

${rssContext ? `СВЕЖАЯ СВОДКА ИЗ RSS-ЛЕНТ:\n${rssContext}\n\n` : ''}
РЕДАКЦИОННАЯ БАЗА ПРИОРИТЕТНЫХ ПЕРВОИСТОЧНИКОВ:
1. ОФИЦИАЛЬНЫЕ САЙТЫ 20 ВЕДУЩИХ СТУДИЙ: ${SOURCES_BASE.studios_20.join(', ')}
2. 50+ АВТОРИТЕТНЫХ ИГРОВЫХ СМИ И БАЗ ДАННЫХ: ${SOURCES_BASE.gaming_media_50.join(', ')}
3. ПРОИЗВОДИТЕЛИ ИГРОВОГО ЖЕЛЕЗА (GPU, CPU, периферия, тесты): ${SOURCES_BASE.hardware_vendors.join(', ')}
4. СОЦСЕТЬ X (комментарии геймдиректоров, инсайдеров, официальные треды): ${SOURCES_BASE.x_accounts.join(', ')}

ЖЁСТКИЕ РЕДАКЦИОННЫЕ И ЮРИДИЧЕСКИЕ ПРАВИЛА:
1. УНИКАЛЬНОСТЬ (КРИТИЧНО): КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО писать о событиях, фактах или инфоповодах, которые уже освещались в последних статьях и черновиках на сайте (даже под другим заголовком, с другими цифрами V/VI или с акцентом на другую деталь того же события!).
УЖЕ ОСВЕЩЁННЫЕ ТЕМЫ (НЕ ПОВТОРЯТЬ):
- ${existingSummaries || 'база пока пуста'}
${rejectedTopics.length ? `\nОТКЛОНЁННЫЕ В ЭТОМ ЗАПУСКЕ ДУБЛИ (ВЫБЕРИ ДРУГУЮ ИГРУ И ДРУГОЙ ИНФОПОВОД):\n- ${rejectedTopics.join('\n- ')}\n` : ''}
2. ПРАВИЛО ДВОЙНОГО ФАКТЧЕКИНГА: Опирайся на факты, подтверждённые минимум в ДВУХ независимых источниках из сводки, баз данных (SteamDB, Metacritic, OpenCritic, HLTV, Liquipedia) или официальных заявлениях студий/инсайдеров. Перечисли названия источников в поле sourcesUsed.
3. ЗАПРЕТ НА КОПИПАСТ И SEO-ПРАВИЛО: Категорически запрещено дословно переводить чужую статью абзац за абзацем. Извлеки только сухие факты, цифры и официальные цитаты и напиши полностью самостоятельный журналистский текст на русском языке с упоминанием первоисточников в тексте. В заголовке и первом абзаце обязательно укажи официальное английское название игры, студии или киберспортивной дисциплины.
4. ОБЯЗАТЕЛЬНАЯ СТРУКТУРА (4 абзаца):
   - Абзац 1 (Лид и суть события): Что именно произошло, точные цифры, оценки, даты, имена спикеров, названия игр или видеокарт/процессоров.
   - Абзац 2 (Подробности и реакция индустрии): Детали из разных источников, комментарии разработчиков/игроков, технические нюансы.
   - Абзац 3 (Бэкграунд и контекст): История вопроса, сравнение с предыдущими релизами студии или поколениями железа.
   - Абзац 4 (Редакторский вывод): Что это значит для игроков и чего ждать дальше.
5. ТОЧНЫЙ ПОДБОР ОФИЦИАЛЬНОЙ ОБЛОЖКИ (СТРОГАЯ ИЕРАРХИЯ):
   - Шаг А (Конкретная игра или киберспортивная дисциплина): Если в материале разбирается конкретная игра (включая инди, новинки/резонанс, анонсированные сиквелы или киберспорт — например, "Nioh 3", "Counter-Strike 2", "Dota 2", "Hades II", "Cyberpunk 2077"), укажи в "exactGameName" её точное английское название в Steam (без лишних приписок вроде "Complete Edition"), а в "platformBrand" напиши "none". Предыдущую часть серии указывай ТОЛЬКО в "backupGameName" на случай, если у новой игры ещё нет страницы в Steam.
   - Шаг Б (Корпорации, суды, консоли, магазины, подписки): Если новость касается корпорации, судебного разбирательства, цифрового магазина, прошивки консоли или подписки БЕЗ конкретной игры (например: суд против Sony / PlayStation Store, цены на Xbox Game Pass, продажи Nintendo Switch, правила Valve / Steam, видеокарты NVIDIA / AMD) — НЕ подставляй случайную игру! В полях "exactGameName" и "backupGameName" напиши "none", а в поле "platformBrand" укажи одно из значений: "playstation", "xbox", "nintendo", "steam" или "hardware".
   - Шаг В (Разработчик игр без конкретной игры): Если новость касается именно игровой студии-разработчика и в тексте упоминается или подразумевается их главная франшиза — укажи её в "exactGameName", а "platformBrand" поставь "none".
   - В поле "backupGameName" укажи вторую запасную игру этой студии/серии в Steam или "none".

Верни ответ СТРОГО в формате чистого JSON (без markdown-тегов \`\`\`json и пояснений вокруг):
{
  "category": "одна из: ПК и Консоли | Инди | Киберспорт | Новинки и резонанс | Индустрия",
  "title": "сильный, информативный заголовок на русском языке без кликбейта (НЕ начинай заголовок со слов «Обзор» или «Рецензия» — фокусируйся на самом событии, рекордах, оценках или реакции игроков)",
  "excerpt": "ёмкий анонс статьи в 1–2 предложения",
  "content": [
    "первый абзац (3–5 предложений)",
    "второй абзац (3–5 предложений)",
    "третий абзац (3–4 предложения)",
    "четвёртый абзац (2–3 предложения)"
  ],
  "sourcesUsed": ["Источник 1", "Источник 2"],
  "exactGameName": "точное английское название игры в Steam или none",
  "backupGameName": "запасная игра этой студии/серии в Steam или none",
  "platformBrand": "playstation | xbox | nintendo | steam | hardware | none",
  "tags": ["Тег1", "Тег2", "Тег3", "Тег4"]
}`;
}

async function callGemini(model, prompt, useGoogleSearch) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.45 }
  };
  if (useGoogleSearch) payload.tools = [{ google_search: {} }];
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    45000
  );
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

function normalizeTokens(text) {
  const stopWords = new Set([
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то', 'все', 'она',
    'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за', 'бы', 'по', 'только', 'ее',
    'мне', 'было', 'вот', 'от', 'меня', 'еще', 'нет', 'о', 'из', 'ему', 'теперь', 'когда',
    'даже', 'ну', 'вдруг', 'ли', 'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до',
    'вас', 'нибудь', 'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей',
    'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя', 'их', 'чем',
    'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже', 'себе', 'под', 'будет',
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have',
    'игра', 'игры', 'игр', 'релиз', 'выход', 'обзор', 'новости', 'студии', 'разработчики', 'игроков'
  ]);
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/\bvi\b/g, '6')
    .replace(/\bv\b/g, '5')
    .replace(/\biv\b/g, '4')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/[^a-zа-яё0-9\s]/gi, ' ');

  return new Set(
    normalized
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const unionSize = setA.size + setB.size - intersection;
  return unionSize > 0 ? intersection / unionSize : 0;
}

function findDuplicateArticle(candidate) {
  const candTitleTokens = normalizeTokens(candidate.title);
  const candLeadTokens = normalizeTokens(`${candidate.title} ${candidate.excerpt || ''}`);

  for (const existing of recentArticles) {
    const exTitleTokens = normalizeTokens(existing.title);
    const exLeadTokens = normalizeTokens(`${existing.title} ${existing.excerpt || ''}`);

    const titleSim = jaccardSimilarity(candTitleTokens, exTitleTokens);
    const leadSim = jaccardSimilarity(candLeadTokens, exLeadTokens);

    if (titleSim >= 0.42 || leadSim >= 0.36) {
      return existing.title;
    }
  }
  return null;
}

function safeParseGeminiJson(rawText) {
  if (!rawText) return null;
  let cleaned = rawText.replace(/```json|```/gi, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  try {
    const obj = JSON.parse(cleaned);
    const hasTitle = typeof obj?.title === 'string' && obj.title.trim().length > 0;
    const hasContent =
      (Array.isArray(obj?.content) && obj.content.length > 0) ||
      (typeof obj?.content === 'string' && obj.content.trim().length > 0);
    return hasTitle && hasContent ? obj : null;
  } catch (_) {
    return null;
  }
}

async function run() {
  const preferredCategories = getPreferredCategories();
  console.log('Режим горячих новостей. Мягкий приоритет рубрик:', preferredCategories.join(', '));

  const models = await getAvailableModels();
  const rssContext = await fetchFreshRssNews();
  const rejectedTopics = [];
  let parsed = null;

  for (let attempt = 1; attempt <= 3 && !parsed; attempt++) {
    for (const model of models) {
      try {
        const useSearch = attempt === 1;
        const rawText = await callGemini(
          model,
          buildPrompt(rssContext, preferredCategories, rejectedTopics),
          useSearch
        );
        const candidate = safeParseGeminiJson(rawText);
        if (!candidate) {
          console.log(`[Попытка ${attempt}, ${model}] Не удалось распарсить JSON ответа.`);
          continue;
        }

        const duplicateOf = findDuplicateArticle(candidate);
        if (duplicateOf) {
          console.log(`[Попытка ${attempt}, ${model}] Отклонён дубль (похоже на «${duplicateOf}»): ${candidate.title}`);
          rejectedTopics.push(`${candidate.title} (дубль статьи «${duplicateOf}»)`);
          break;
        }

        parsed = candidate;
        break;
      } catch (err) {
        console.log(`[Попытка ${attempt}, ${model}] Ошибка запроса: ${err.message}`);
        if (err.status === 429 || err.status === 503) {
          await sleep(12000);
        }
      }
    }
  }

  if (!parsed) {
    console.log('Новых уникальных горячих тем не найдено (попыток: 3). Завершаем без ошибки.');
    return;
  }

  const chosenCategory = ALL_CATEGORIES.includes(parsed.category) ? parsed.category : preferredCategories[0];

  // Легальный подбор уникальной обложки
  let finalImage = '';
  const brand = (parsed.platformBrand || '').toLowerCase().trim();
  if (brand && brand !== 'none' && PLATFORM_COVERS[brand]) {
    finalImage = pickUnusedCover(PLATFORM_COVERS[brand]);
  }

  if (!finalImage) {
    const candidates = [
      parsed.exactGameName,
      parsed.backupGameName
    ].filter(
      name =>
        name &&
        name.toLowerCase() !== 'none' &&
        /^[a-zA-Z0-9\s:'".-]+$/.test(name) &&
        name.length > 2
    );

    for (const gameName of candidates) {
      finalImage = await findSteamCover(gameName);
      if (finalImage) break;
    }
  }

  if (!finalImage) {
    const fallbackPool = LEGAL_FALLBACK_COVERS[chosenCategory] || LEGAL_FALLBACK_COVERS['ПК и Консоли'];
    finalImage = pickUnusedCover(fallbackPool);
  }

  const contentArray = Array.isArray(parsed.content)
    ? parsed.content.map(p => String(p).trim()).filter(Boolean)
    : [String(parsed.content || '').trim()].filter(Boolean);
  const sources = Array.isArray(parsed.sourcesUsed) ? parsed.sourcesUsed.filter(Boolean) : [];
  if (sources.length) {
    contentArray.push(`Источники: ${sources.join(', ')}.`);
  }

  const tags =
    Array.isArray(parsed.tags) && parsed.tags.length > 0
      ? parsed.tags.map(t => String(t).trim()).filter(Boolean)
      : ['Игры', 'Новости'];

  const newArticle = {
    id: Date.now(),
    status: 'draft',
    category: chosenCategory,
    title: parsed.title.trim(),
    excerpt: String(parsed.excerpt || '').trim(),
    content: contentArray,
    sourcesUsed: sources,
    image: finalImage,
    author: 'Редакция BUGROVGAMES',
    date: new Date().toISOString().split('T')[0],
    views: 0,
    likes: 0,
    tags,
    isFeatured: false
  };

  articles.unshift(newArticle);
  fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2), 'utf8');
  console.log(`Добавлен черновик [${newArticle.category}]:`, newArticle.title, '| Обложка:', finalImage);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
