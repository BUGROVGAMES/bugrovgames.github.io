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

async function getAvailableModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
  if (!res.ok) return ['gemini-3.8-flash', 'gemini-3.0-flash', 'gemini-2.0-flash'];
  const data = await res.json();
  const names = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(n => n.includes('flash') && !n.includes('image') && !n.includes('audio'));
  return names.length ? names : ['gemini-3.8-flash'];
}

// Парсим RSS вместе с реальными ссылками на картинки из новостей
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
        const desc = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1]
          || block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 450);

        // Ищем картинку внутри RSS-элемента
        const imgUrl = (
          block.match(/<media:content[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1] ||
          block.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1] ||
          block.match(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1] ||
          ''
        ).trim();

        if (title) {
          items.push(`- [${new URL(feedUrl).hostname}] ${title} | IMG: ${imgUrl || 'none'} | ${desc}`);
        }
      }
    } catch (_) {}
  }
  return items.slice(0, 35).join('\n');
}

// Поиск точной обложки в базе Steam API по названию игры
async function findSteamCover(gameTitle) {
  if (!gameTitle || gameTitle.toLowerCase() === 'none') return null;
  try {
    const query = encodeURIComponent(gameTitle.trim());
    const res = await fetch(`https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=US`);
    if (!res.ok) return null;
    const data = await res.json();
    const first = data.items?.[0];
    if (first && first.id) {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${first.id}/header.jpg`;
    }
  } catch (_) {}
  return null;
}

function buildPrompt(rssContext) {
  return `Ты — выпускающий редактор и ведущий аналитик игрового медиапортала BUGROVGAMES.
Твоя задача — отобрать и глубоко разобрать ОДНУ самую резонансную новость за последние 24–48 часов, опираясь на свежую сводку из мировых СМИ и нашу редакционную базу первоисточников.

${rssContext ? `СВЕЖАЯ СВОДКА ИЗ RSS-ЛЕНТ (с прикреплёнными URL изображений IMG):\n${rssContext}\n\n` : ''}
РЕДАКЦИОННАЯ БАЗА ПРИОРИТЕТНЫХ ПЕРВОИСТОЧНИКОВ:
1. ОФИЦИАЛЬНЫЕ САЙТЫ 20 ВЕДУЩИХ СТУДИЙ: ${SOURCES_BASE.studios_20.join(', ')}
2. 50 АВТОРИТЕТНЫХ ИГРОВЫХ СМИ И БАЗ ДАННЫХ: ${SOURCES_BASE.gaming_media_50.join(', ')}
3. ПРОИЗВОДИТЕЛИ ИГРОВОГО ЖЕЛЕЗА (GPU, CPU, периферия, тесты): ${SOURCES_BASE.hardware_vendors.join(', ')}
4. СОЦСЕТЬ X (комментарии геймдиректоров, инсайдеров, официальные треды): ${SOURCES_BASE.x_accounts.join(', ')}

ЖЁСТКИЕ РЕДАКЦИОННЫЕ ПРАВИЛА:
1. ВЫБОР ТЕМЫ И УНИКАЛЬНОСТЬ: Выбери ОДНУ самую громкую и обсуждаемую новость. Тема НЕ ДОЛЖНА повторять уже существующие статьи на сайте: [${existingTitles || 'база пока пуста'}].
2. ПРАВИЛО ДВОЙНОГО ФАКТЧЕКИНГА: Опирайся на факты, подтверждённые минимум в ДВУХ независимых источниках из сводки или официальных заявлениях студий/инсайдеров. Перечисли источники в поле sourcesUsed.
3. ЗАПРЕТ НА КОПИПАСТ: Категорически запрещено дословно переводить одну заметку абзац за абзацем. Синтезируй факты в самостоятельный журналистский текст на русском языке.
4. ОБЯЗАТЕЛЬНАЯ СТРУКТУРА (4 абзаца):
   - Абзац 1 (Лид и суть события): Что именно произошло, точные цифры, даты, имена спикеров, названия игр или видеокарт/процессоров.
   - Абзац 2 (Подробности и реакция индустрии): Детали из разных источников, комментарии разработчиков, технические нюансы.
   - Абзац 3 (Бэкграунд и контекст): История вопроса, сравнение с предыдущими релизами студии или поколениями железа.
   - Абзац 4 (Редакторский вывод): Что это значит для игроков и чего ждать дальше.
5. ТОЧНЫЙ ПОДБОР ОБЛОЖКИ:
   - В поле "exactGameName" укажи точное официальное английское название игры, о которой идёт речь (например: "Grand Theft Auto V", "Elden Ring", "Counter-Strike 2", "S.T.A.L.K.E.R. 2"). Если новость про видеокарту, консоль или индустрию без конкретной игры — напиши "none".
   - В поле "rssImageUrl" скопируй прямую ссылку из поля IMG выбранной новости из RSS-сводки (если она есть и не равна "none"), иначе напиши "".

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
  "sourcesUsed": ["источник 1", "источник 2"],
  "exactGameName": "точное английское название игры или none",
  "rssImageUrl": "прямая ссылка на картинку из RSS или пустая строка",
  "tags": ["Тег1", "Тег2", "Тег3", "Тег4"]
}`;
}

async function callGemini(model, prompt, useGoogleSearch) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5 }
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
  let rawText = '';

  for (const model of models) {
    try {
      rawText = await callGemini(model, buildPrompt(''), true);
      if (rawText) break;
    } catch (_) {}
  }

  if (!rawText) {
    const rssContext = await fetchFreshRssNews();
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

  // 3-ступенчатый выбор точной обложки
  let finalImage = '';
  if (parsed.rssImageUrl && parsed.rssImageUrl.startsWith('http')) {
    finalImage = parsed.rssImageUrl;
  }
  if (!finalImage && parsed.exactGameName && parsed.exactGameName.toLowerCase() !== 'none') {
    finalImage = await findSteamCover(parsed.exactGameName);
  }
  if (!finalImage) {
    // Тематические обложки без привязки к Cyberpunk
    finalImage = parsed.category === 'Индустрия'
      ? 'https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80'
      : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80';
  }

  const newArticle = {
    id: Date.now(),
    status: 'draft',
    category: parsed.category || 'ПК и Консоли',
    title: parsed.title,
    excerpt: parsed.excerpt,
    content: parsed.content,
    sourcesUsed: parsed.sourcesUsed || [],
    image: finalImage,
    author: 'AI-Репортёр BUGROVGAMES',
    date: new Date().toISOString().split('T')[0],
    views: 0,
    likes: 0,
    tags: parsed.tags || ['Игры', 'Новости'],
    isFeatured: false
  };

  articles.unshift(newArticle);
  fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2), 'utf8');
  console.log('Добавлен черновик:', newArticle.title, '| Обложка:', finalImage);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
