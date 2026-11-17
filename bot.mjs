import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Ошибка: не задан GEMINI_API_KEY');
  process.exit(1);
}

const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const existingTitles = articles.slice(0, 40).map(a => a.title).join(' | ');

const SOURCES_BASE = {
  studios_20: [
    'rockstargames.com', 'cdprojektred.com', 'fromsoftware.jp', 'naughtydog.com',
    'larion.com', 'bethesda.net', 'insomniac.games', 'capcom.com', 'valvesoftware.com',
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

const prompt = `Ты — выпускающий редактор и ведущий аналитик игрового медиапортала BUGROVGAMES.
Твоя задача — провести мониторинг свежих событий за последние 24–48 часов по следующим базам источников:

1. ОФИЦИАЛЬНЫЕ САЙТЫ 20 ВЕДУЩИХ СТУДИЙ:
${SOURCES_BASE.studios_20.join(', ')}

2. 50 АВТОРИТЕТНЫХ ИГРОВЫХ СМИ И БАЗ ДАННЫХ:
${SOURCES_BASE.gaming_media_50.join(', ')}

3. ПРОИЗВОДИТЕЛИ ИГРОВОГО ЖЕЛЕЗА И ТЕХНОЛОГИЙ (GPU, CPU, периферия, тесты производительности):
${SOURCES_BASE.hardware_vendors.join(', ')}

4. СОЦСЕТЬ X (заявления геймдиректоров, инсайдеров, официальные треды студий):
${SOURCES_BASE.x_accounts.join(', ')}

ЖЁСТКИЕ РЕДАКЦИОННЫЕ ПРАВИЛА:
1. ВЫБОР ТЕМЫ И УНИКАЛЬНОСТЬ: Выбери ОДНУ самую резонансную новость (крупный анонс, скандал, перенос, патч, рекорд онлайна, важный комментарий в X или прорыв в игровом железе/драйверах). Тема НЕ ДОЛЖНА пересекаться с уже опубликованными или черновиками на сайте: [${existingTitles || 'база пока пуста'}].
2. ПРАВИЛО ДВОЙНОГО ФАКТЧЕКИНГА: Никогда не пиши статью по одному случайному источнику. Обязательно найди подтверждение фактов минимум в ДВУХ независимых источниках (например: пост в X или блог студии + материал в крупном СМИ). Если подтверждения нет — выбери другую тему.
3. ЗАПРЕТ НА КОПИПАСТ И ПОВЕРХНОСТНЫЙ РЕРАЙТ: Запрещено переводить или пересказывать одну статью абзац за абзацем. Синтезируй информацию из нескольких источников в самостоятельный журналистский текст.
4. ГЛУБИНА И БЭКГРАУНД:
   - Абзац 1 (Лид и суть): Что именно произошло, точные цифры, даты, имена спикеров или названия технологий.
   - Абзац 2 (Детали из разных источников): Подробности, реакция сообщества или заявления разработчиков в X, технические нюансы.
   - Абзац 3 (Контекст и значение для индустрии): Почему это важно для игроков, как это связано с предыдущими проектами студии или ситуацией на рынке железа/игр.
5. СТИЛЬ: Профессиональный, живой язык игровой журналистики без канцелярита и штампов вроде «в мире игр произошло событие» или «фанаты с нетерпением ждут».

Верни ответ СТРОГО в формате чистого JSON (без markdown-тегов \`\`\`json и пояснений вокруг):
{
  "category": "одна из: ПК и Консоли | Инди | Киберспорт | Обзоры | Индустрия",
  "title": "сильный, информативный заголовок на русском языке без кликбейта",
  "excerpt": "ёмкий анонс статьи в 1–2 предложения",
  "content": [
    "первый абзац (3–5 предложений)",
    "второй абзац (3–5 предложений)",
    "третий абзац (3–4 предложения)"
  ],
  "sourcesUsed": ["источник 1", "источник 2"],
  "steamAppId": "числовой AppID игры в Steam, если новость об игре из Steam (например 1091500 для Cyberpunk 2077, 1245620 для Elden Ring, 730 для CS2), иначе 1091500",
  "tags": ["Тег1", "Тег2", "Тег3", "Тег4"]
}`;

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.5
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const cleanJson = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleanJson);

  const today = new Date().toISOString().split('T')[0];
  const appId = String(parsed.steamAppId || '1091500').replace(/\D/g, '') || '1091500';

  const newArticle = {
    id: Date.now(),
    status: 'draft',
    category: parsed.category || 'ПК и Консоли',
    title: parsed.title,
    excerpt: parsed.excerpt,
    content: parsed.content,
    sourcesUsed: parsed.sourcesUsed || [],
    image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    author: 'AI-Репортёр BUGROVGAMES',
    date: today,
    views: 0,
    likes: 0,
    tags: parsed.tags || ['Игры', 'Новости'],
    isFeatured: false
  };

  articles.unshift(newArticle);
  fs.writeFileSync('articles.json', JSON.stringify(articles, null, 2), 'utf8');
  console.log('Добавлен проверенный черновик:', newArticle.title, '| Источники:', newArticle.sourcesUsed.join(', '));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
