const express = require('express');
const cors = require('cors');
const gen = require('./generator');
const store = require('./store');

const app = express();
const port = process.env.PORT || 3201;

app.use(cors());
app.use(express.json({ limit: '8mb' }));

app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    service: 'lince-kyc',
    store: store.source(),
    countries: gen.COUNTRIES.length,
  });
});

app.get('/api/kyc/catalog', (_req, res) => {
  res.json({ countries: gen.COUNTRIES, activities: gen.ACTIVITIES });
});

app.get('/api/kyc/recent', async (_req, res) => {
  res.json({ schemas: await store.recentSchemas() });
});

function intake(body = {}, query = {}) {
  const country = String(body.country || query.country || 'VE').toUpperCase();
  const activity = String(body.activity || query.activity || 'persona');
  const volumeUsd = Number(body.volumeUsd || query.volumeUsd || 1200);
  const override = String(body.risk || query.risk || 'auto');
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const risk = gen.resolveRisk({ country, activity, volumeUsd, override });
  return { country, activity, volumeUsd, override, answers, risk };
}

app.get('/api/kyc/generate', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  const ctx = intake({}, req.query);
  const built = gen.buildSchema(ctx);
  await store.saveSchema({
    id: built.schema.id,
    country: ctx.country,
    risk: ctx.risk,
    activity: ctx.activity,
    volumeUsd: ctx.volumeUsd,
    prompt: built.prompt,
    rationale: built.schema.rationale,
    schema: built.schema,
    createdAt: new Date(),
  });
  req.on('close', () => res.end());
  try {
    await gen.stream(res, built);
  } finally {
    res.end();
  }
});

app.post('/api/kyc/adapt', (req, res) => {
  const ctx = intake(req.body);
  const built = gen.buildSchema(ctx);
  res.json({ schema: built.schema, thoughts: built.thoughts, prompt: built.prompt });
});

app.post('/api/kyc/submit', async (req, res) => {
  const schema = req.body?.schema;
  const payload = req.body?.payload;
  if (!schema?.id || !payload) {
    res.status(400).json({ ok: false, error: 'Falta schema o payload' });
    return;
  }
  const id = `sub_${Date.now().toString(36)}`;
  await store.saveSubmission({
    id,
    schemaId: schema.id,
    country: schema.country,
    risk: schema.risk,
    payload,
  });
  res.json({ ok: true, id, store: store.source() });
});

async function boot() {
  await store.initStore();
  app.listen(port, () => {
    console.log(`LINCE KYC API http://localhost:${port} [${store.source()}]`);
  });
}

boot().catch((error) => {
  console.error(error);
  process.exit(1);
});
