const path = require('path');
const fs = require('fs');
const Fastify = require('fastify');
const multipart = require('@fastify/multipart');
const fastifyStatic = require('fastify-static');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');

const app = Fastify({ logger: false });
const PORT = process.env.PORT || 3000;

// IMPORTANT FOR RENDER:
// If you add a Render Persistent Disk, set its Mount Path to:
// /opt/render/project/src/data
// This app will also support custom DATA_DIR if you add it in Render Environment.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const DB_FILE = path.join(DATA_DIR, 'active-upload.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_DATA = {
  fileName: 'default-sample-data',
  uploadedAt: null,
  links: [
    'https://example.com/location-1',
    'https://example.com/location-2',
    'https://example.com/location-3'
  ],
  texts: [
    'Example text suggestion one.',
    'Example text suggestion two.',
    'Example text suggestion three.'
  ]
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function getActiveData() {
  const saved = readJson(DB_FILE, null);
  if (saved && Array.isArray(saved.links) && Array.isArray(saved.texts)) return saved;
  return DEFAULT_DATA;
}

function getProgress() {
  return readJson(PROGRESS_FILE, { users: {} });
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseRows(buffer, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  let rows = [];

  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  } else {
    const text = buffer.toString('utf8');
    rows = parse(text, { relax_column_count: true, skip_empty_lines: true });
  }

  const links = [];
  const texts = [];

  for (const row of rows) {
    const values = row.map(v => String(v || '').trim()).filter(Boolean);
    for (const value of values) {
      if (/^https?:\/\//i.test(value)) links.push(value);
      else if (value.length > 2) texts.push(value);
    }
  }

  return { links: [...new Set(links)], texts: [...new Set(texts)] };
}

app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
app.register(fastifyStatic, { root: path.join(__dirname, 'public'), prefix: '/' });

app.get('/api/active-data', async () => {
  const data = getActiveData();
  return {
    fileName: data.fileName,
    uploadedAt: data.uploadedAt,
    linkCount: data.links.length,
    textCount: data.texts.length,
    usingDefault: !data.uploadedAt,
    storagePath: DATA_DIR
  };
});

app.get('/api/random', async (req) => {
  const user = String(req.query.user || 'user');
  const data = getActiveData();

  return {
    user,
    link: randomFrom(data.links),
    text: randomFrom(data.texts),
    fileName: data.fileName
  };
});

app.post('/api/upload', async (req, reply) => {
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'No file uploaded.' });

  const buffer = await file.toBuffer();
  const parsed = parseRows(buffer, file.filename);

  if (!parsed.links.length || !parsed.texts.length) {
    return reply.code(400).send({ error: 'File must include at least one URL and one text suggestion.' });
  }

  const active = {
    fileName: file.filename,
    uploadedAt: new Date().toISOString(),
    links: parsed.links,
    texts: parsed.texts
  };

  writeJson(DB_FILE, active);

  return {
    success: true,
    message: 'File saved and active until replaced.',
    fileName: active.fileName,
    linkCount: active.links.length,
    textCount: active.texts.length,
    storagePath: DATA_DIR
  };
});

app.post('/api/mark-done', async (req) => {
  const { user = 'user', link = '', text = '' } = req.body || {};
  const progress = getProgress();

  if (!progress.users[user]) progress.users[user] = { count: 0, items: [] };

  progress.users[user].count += 1;
  progress.users[user].items.unshift({
    link,
    text,
    doneAt: new Date().toISOString()
  });

  progress.users[user].items = progress.users[user].items.slice(0, 200);
  writeJson(PROGRESS_FILE, progress);

  return { success: true, user, count: progress.users[user].count };
});

app.get('/api/progress', async () => getProgress());

app.listen({ port: PORT, host: '0.0.0.0' }, () => {
  console.log(`App running on http://localhost:${PORT}`);
  console.log(`Persistent data folder: ${DATA_DIR}`);
});
