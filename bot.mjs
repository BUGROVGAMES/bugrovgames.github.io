import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Ошибка: не задан GEMINI_API_KEY');
  process.exit(1);
}

const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const existingTitles = articles.slice(0, 40).map(a => a.title).join(' | ');

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
  'https://www.techpowerup.com/rss/news'
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
    'cybersport.ru', 'hltv.org', 'liquipedia.net'
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

// Легальные стоковые обложки (CC0 / Unsplash) для тем без страницы игры в Steam
const LEGAL_FALLBACK_COVERS = {
  'ПК и Консоли': 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=1200&q=80',
  'Инди': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
  'Киберспорт': 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
  'Обзоры': 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=1200&q=80',
  'Индустрия': 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80'
};

async function getAvailableModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
  if (!res.ok) return ['gemini-2.5-flash', 'gemini-2.0-flash'];
  const data = await res.json();
  const names = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(n => n.includes('flash') && !n.includes('image') && !n.includes('audio'));
  return names.length ? names : ['gemini-2.5-flash'];
}

// Парсим ТОЛЬКО заголовки, ссылки на первоисточники и факты (без чужих картинок)
async function fetchFreshRssNews() {
  const items = [];
  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, { headers: { 'User-Agent': 'BUGROVGAMES-Bot/1.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 4);
      for (const m of matches) {
        const block = m[1];
        const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]
          || block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
        const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
        const desc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1]
          || block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

        if (title) {
          items.push(`- [${new URL(feedUrl).hostname}] ${title} | URL: ${link} | ${desc}`);
        }
      }
    } catch (_) {}
  }
  return items.slice(0, 35).join('\n');
}

// Поиск официального пресс-постера игры в базе Steam Store API
async function findSteamCover(gameTitle) {
  if (!gameTitle || gameTitle.toLowerCase() === 'none') return null;
  try {
    const query = encodeURIComponent(gameTitle.trim());
    const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=US`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.items?.[0];
    if (first && first.id) {
      const coverUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${first.id}/header.jpg`;
      // Проверяем, что обложка реально отдаётся без ошибок
      const check = await fetch(coverUrl, { method: 'HEAD' });
      if (check.ok) return coverUrl;
    }
  } catch (_) {}
  return null;
}

function buildPrompt(rssContext) {
  return `Ты — выпускающий редактор и ведущий аналитик игрового медиапортала BUGROVGAMES.
Твоя задача — отобрать и глубоко разобрать ОДНУ самую резонансную новость за последние 24–48 часов, опираясь на свежую сводку из мировых СМИ и нашу редакционную базу первоисточников.

${rssContext ? `СВЕЖАЯ СВОДКА ИЗ RSS-ЛЕНТ:\n${rssContext}\n\n` : ''}
РЕДАКЦИОННАЯ БАЗА ПРИОРИТЕТНЫХ ПЕРВОИСТОЧНИКОВ:
1. ОФИЦИАЛЬНЫЕ САЙТЫ 20 ВЕДУЩИХ СТУДИЙ: ${SOURCES_BASE.studios_20.join(', ')}
2. 50 АВТОРИТЕТНЫХ ИГРОВЫХ СМИ И БАЗ ДАННЫХ: ${SOURCES_BASE.gaming_media_50.join(', ')}
3. ПРОИЗВОДИТЕЛИ ИГРОВОГО ЖЕЛЕЗА (GPU, CPU, периферия, тесты): ${SOURCES_BASE.hardware_vendors.join(', ')}
4. СОЦСЕТЬ X (комментарии геймдиректоров, инсайдеров, официальные треды): ${SOURCES_BASE.x_accounts.join(', ')}

ЖЁСТКИЕ РЕДАКЦИОННЫЕ И ЮРИДИЧЕСКИЕ ПРАВИЛА:
1. ВЫБОР ТЕМЫ И УНИКАЛЬНОСТЬ: Выбери ОДНУ самую громкую и обсуждаемую новость. Тема НЕ ДОЛЖНА повторять уже существующие статьи на сайте: [${existingTitles || 'база пока пуста'}].
2. ПРАВИЛО ДВОЙНОГО ФАКТЧЕКИНГА: Опирайся на факты, подтверждённые минимум в ДВУХ независимых источниках из сводки или официальных заявлениях студий/инсайдеров. Перечисли названия источников (например: "Video Games Chronicle", "Eurogamer", "Rockstar Games") в поле sourcesUsed.
3. ЗАПРЕТ НА КОПИПАСТ (АВТОРСКОЕ ПРАВО): Категорически запрещено дословно переводить чужую статью абзац за абзацем. Извлеки только сухие факты, цифры и официальные цитаты и напиши полностью самостоятельный журналистский текст на русском языке с упоминанием первоисточников в тексте (например: «Как сообщает издание...», «По данным...»).
4. ОБЯЗАТЕЛЬНАЯ СТРУКТУРА (4 абзаца):
   - Абзац 1 (Лид и суть события): Что именно произошло, точные цифры, даты, имена спикеров, названия игр или видеокарт/процессоров.
   - Абзац 2 (Подробности и реакция индустрии): Детали из разных источников, комментарии разработчиков, технические нюансы.
   - Абзац 3 (Бэкграунд и контекст): История вопроса, сравнение с предыдущими релизами студии или поколениями железа.
   - Абзац 4 (Редакторский вывод): Что это значит для игроков и чего ждать дальше.
5. 5. ТОЧНЫЙ ПОДБОР ОФИЦИАЛЬНОЙ ОБЛОЖКИ (СТРОГАЯ ИЕРАРХИЯ ДЛЯ ПОИСКА В STEAM):
   - Твоя задача — подобрать точное официальное английское название игры, страница которой гарантированно есть в магазине Steam, чтобы подтянуть её официальный постер.
   - Шаг А (Конкретная игра): Если в новости упоминается игра (например, "новая XCOM", "обновление для Cyberpunk 2077", "слухи о Half-Life 3"), укажи в "exactGameName" её точное английское название из Steam ("XCOM 2", "Cyberpunk 2077", "Half-Life 2"). Не пиши невышедшие или безымянные сиквелы без страницы в Steam (вместо "XCOM 3" пиши "XCOM 2", вместо "The Witcher 4" пиши "The Witcher 3: Wild Hunt", вместо "GTA 6" пиши "Grand Theft Auto V").
   - Шаг Б (Новость про студию или издателя): Если новость про увольнения, покупку студии, смену руководства или финансовый отчёт без конкретной игры — укажи самую известную вышедшую в Steam игру этой студии (например: Firaxis -> "XCOM 2" или "Sid Meier's Civilization VI"; Larian -> "Baldur's Gate 3"; Remedy -> "Control Ultimate Edition"; Ubisoft -> "Assassin's Creed Valhalla"; Bethesda -> "Starfield").
   - Шаг В (Эксклюзив консоли или киберспорт): Если игра не выходила на ПК (например, Nintendo или старый эксклюзив PS5) — укажи "none". Для киберспорта укажи дисциплину ("Counter-Strike 2", "Dota 2", "Apex Legends").
   - Шаг Г (Только железо или общие законы): Ставь "none" ТОЛЬКО если в тексте вообще нет ни одной игры и ни одной игровой студии (например, новость исключительно про видеокарты NVIDIA, процессоры AMD или регулирование рынка).
   - В поле "backupGameName" укажи вторую запасную игру этой же студии или жанра из Steam на случай, если первая не найдётся (или "none").
Верни ответ СТРОГО в формате чистого JSON (без markdown-тегов \`\`\`json и пояснений вокруг):
{
  "category": "одна из: ПК и Консоли | Инди | Киберспорт | Обзоры | Индустрия",
  "title": "сильный, информативный заголовок на русском языке без кликбейта",
  "excerpt": "ёмкий анонс статьи в 1–2 предложения",
  "content": [
    "первый абзац (3–5 предложений)",
    "второй абзац (3–5 предложений)",
    "третий абзац (3–4 предложения)",
    "четвёртый абзац (2–3 предложения)"
  ],
  "sourcesUsed": ["Источник 1", "Источник 2"],
  "exactGameName": "точное английское название игры или none",
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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

async function run() {
  const models = await getAvailableModels();
  const rssContext = await fetchFreshRssNews();
  let rawText = '';

  for (const model of models) {
    try {
      rawText = await callGemini(model, buildPrompt(rssContext), true);
      if (rawText) break;
    } catch (_) {}
  }

  if (!rawText) {
    for (const model of models) {
      try {
        rawText = await callGemini(model, buildPrompt(rssContext), false);
        if (rawText) break;
      } catch (_) {}
    }
  }

  if (!rawText) throw new Error('Не удалось получить ответ от Gemini.');

  const cleanJson = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  // Легальный подбор обложки: только официальный пресс-постер Steam или свободная лицензия CC0
  let finalImage = '';
  if (parsed.exactGameName && parsed.exactGameName.toLowerCase() !== 'none') {
    finalImage = await findSteamCover(parsed.exactGameName);
  }
  if (!finalImage) {
    finalImage = LEGAL_FALLBACK_COVERS[parsed.category] || LEGAL_FALLBACK_COVERS['ПК и Консоли'];
  }

  // Добавляем легальную строку атрибуции источников в конец статьи
  const contentArray = Array.isArray(parsed.content) ? [...parsed.content] : [String(parsed.content || '')];
  const sources = Array.isArray(parsed.sourcesUsed) ? parsed.sourcesUsed.filter(Boolean) : [];
  if (sources.length) {
    contentArray.push(`Источники: ${sources.join(', ')}.`);
  }

  const newArticle = {
    id: Date.now(),
    status: 'draft',
    category: parsed.category || 'ПК и Консоли',
    title: parsed.title,
    excerpt: parsed.excerpt,
    content: contentArray,
    sourcesUsed: sources,
    image: finalImage,
    author: 'Редакция BUGROVGAMES',
    date: new Date().toISOString().split('T')[0],
    views: 0,
    likes: 0,
    tags: parsed.tags || ['Игры', 'Новости'],
    isFeatured: false
  };

  articles.unshift(newArticle);
  fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2), 'utf8');
  console.log('Добавлен легальный черновик:', newArticle.title, '| Обложка:', finalImage);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
