import fs from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Ошибка: не задан GEMINI_API_KEY');
  process.exit(1);
}

const articles = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
const existingTitles = articles.slice(0, 30).map(a => a.title).join('; ');

const prompt = `Ты — профессиональный игровой журналист портала BUGROVGAMES.
Найди в интернете через поиск Google одну самую свежую и интересную игровую новость за последние 24 часа (анонс, крупный патч, релиз, рекорд в Steam, инди-хит или новость индустрии).
ВАЖНО: Не повторяй эти темы, которые уже есть на сайте: [${existingTitles}].

Верни ответ СТРОГО в формате чистого JSON (без markdown-обёртки \`\`\`json) следующей структуры:
{
  "category": "одна из: ПК и Консоли | Инди | Киберспорт | Обзоры | Индустрия",
  "title": "яркий журналистский заголовок на русском языке",
  "excerpt": "короткий захватывающий лид в 1-2 предложения",
  "content": ["первый абзац 3-4 предложения", "второй абзац 3-4 предложения", "третий абзац 2-3 предложения"],
  "steamAppId": "числовой AppID этой игры в Steam, если она есть в Steam (например 1091500 для Cyberpunk 2077, 1245620 для Elden Ring, 730 для CS2), иначе 1091500",
  "tags": ["Тег1", "Тег2", "Тег3"]
}`;

async function run() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }]
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
  console.log('Добавлен черновик:', newArticle.title);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
