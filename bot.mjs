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
  'https://insider-gaming.com/feed/'
];

async function getAvailableModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
  if (!res.ok) return ['gemini-3.8-flash', 'gemini-3.0-flash', 'gemini-2.0-flash'];
  const data = await res.json();
  const names = (data.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace('models/', ''))
    .filter(n => n.includes('flash') && !n.includes('image') && !n.includes('audio'));
  console.log('Доступные Flash-модели для ключа:', names.join(', '));
  return names.length ? names : ['gemini-3.8-flash'];
}

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
        if (title) items.push(`- [${new URL(feedUrl).hostname}] ${title}: ${desc}`);
      }
    } catch (_) {}
  }
  return items.slice(0, 25).join('\n');
}

function buildPrompt(rssContext) {
  return `Ты — выпускающий редактор и ведущий аналитик игрового медиапортала BUGROVGAMES.
${rssContext ? `Ниже — свежая сводка реальных заголовков и заметок из ведущих мировых игровых СМИ за последние 24 часа:\n${rssContext}\n\n` : ''}
ЖЁСТКИЕ РЕДАКЦИОННЫЕ ПРАВИЛА:
1. ВЫБОР ТЕМЫ И УНИКАЛЬНОСТЬ: Выбери ОДНУ самую резонансную игровую новость (анонс, крупный патч, релиз, рекорд в Steam, событие индустрии или игрового железа). Тема НЕ ДОЛЖНА повторять уже существующие статьи на сайте: [${existingTitles || 'база пока пуста'}].
2. ПРАВИЛО ДВОЙНОГО ФАКТЧЕКИНГА: Опирайся на факты, подтверждённые минимум в двух источниках или в официальных заявлениях студий/СМИ. Укажи использованные источники в поле sourcesUsed.
3. ЗАПРЕТ НА КОПИПАСТ И ПОВЕРХНОСТНЫЙ РЕРАЙТ: Запрещено дословно переводить одну заметку абзац за абзацем. Синтезируй факты в самостоятельный аналитический материал на русском языке.
4. СТРУКТУРА И ГЛУБИНА:
   - Абзац 1 (Лид и суть): Что именно произошло, точные цифры, даты, названия игр или технологий.
   - Абзац 2 (Подробности и реакция): Детали, реакция игроков и индустрии, технические нюансы.
   - Абзац 3 (Контекст и бэкграунд): Почему это важно для игроков и как это связано с предыдущими релизами студии или рынком.
5. СТИЛЬ: Живой, экспертный язык игровой журналистики без штампов вроде «в мире игр произошло событие».

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
}

async function callGemini(model, prompt, useGoogleSearch) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5 }
  };
  if (useGoogleSearch) {
    payload.tools = [{ google_search: {} }];
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`HTTP ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

async function run() {
  const models = await getAvailableModels();
  let rawText = '';

  // Попытка 1: через встроенный Google Search
  for (const model of models) {
    try {
      console.log(`Пробуем модель ${model} с Google Search...`);
      rawText = await callGemini(model, buildPrompt(''), true);
      if (rawText) break;
    } catch (e) {
      console.warn(`Модель ${model} (Google Search) недоступна: ${e.status}`);
    }
  }

  // Попытка 2: если Google Search упёрся в квоту 429 на Free Tier — берём реальные новости из RSS
  if (!rawText) {
    console.log('Переключаемся на бесплатный сбор свежих новостей через RSS ведущих игровых СМИ...');
    const rssContext = await fetchFreshRssNews();
    for (const model of models) {
      try {
        console.log(`Генерируем статью через ${model} на основе RSS...`);
        rawText = await callGemini(model, buildPrompt(rssContext), false);
        if (rawText) break;
      } catch (e) {
        console.warn(`Модель ${model} (RSS) ошибка: ${e.status}`);
      }
    }
  }

  if (!rawText) {
    throw new Error('Не удалось получить ответ ни от одной доступной модели Gemini.');
  }

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
