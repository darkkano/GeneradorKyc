const { desc } = require('drizzle-orm');

const memory = { schemas: [], submissions: [] };
let dbOk = false;
let db;
let schema;

async function initStore() {
  try {
    ({ db, schema } = require('./db'));
    await db.select({ id: schema.formSchemas.id }).from(schema.formSchemas).limit(1);
    dbOk = true;
    console.log('Drizzle: store KYC listo.');
  } catch (error) {
    dbOk = false;
    console.warn(
      `Drizzle no disponible (${String(error.message || error).split('\n')[0]}). Schemas en memoria.`,
    );
  }
}

async function saveSchema(record) {
  memory.schemas.unshift(record);
  memory.schemas = memory.schemas.slice(0, 40);
  if (!dbOk || !db) {
    return;
  }
  try {
    await db.insert(schema.formSchemas).values({
      id: record.id,
      country: record.country,
      risk: record.risk,
      activity: record.activity,
      volumeUsd: record.volumeUsd,
      prompt: record.prompt,
      rationale: record.rationale,
      schemaJson: JSON.stringify(record.schema),
    });
  } catch (error) {
    dbOk = false;
    console.warn('No pude persistir form_schemas:', String(error.message || error).split('\n')[0]);
  }
}

async function saveSubmission(record) {
  memory.submissions.unshift(record);
  if (!dbOk || !db) {
    return;
  }
  try {
    await db.insert(schema.submissions).values({
      id: record.id,
      schemaId: record.schemaId,
      country: record.country,
      risk: record.risk,
      payload: JSON.stringify(record.payload),
    });
  } catch (error) {
    dbOk = false;
    console.warn('No pude persistir submissions:', String(error.message || error).split('\n')[0]);
  }
}

async function recentSchemas() {
  if (dbOk && db) {
    try {
      const rows = await db
        .select()
        .from(schema.formSchemas)
        .orderBy(desc(schema.formSchemas.createdAt))
        .limit(8);
      return rows.map((row) => ({
        id: row.id,
        country: row.country,
        risk: row.risk,
        activity: row.activity,
        createdAt: row.createdAt,
        rationale: row.rationale,
      }));
    } catch {
      dbOk = false;
    }
  }
  return memory.schemas.slice(0, 8).map((row) => ({
    id: row.id,
    country: row.country,
    risk: row.risk,
    activity: row.activity,
    createdAt: row.createdAt,
    rationale: row.rationale,
  }));
}

function source() {
  return dbOk ? 'drizzle' : 'memory';
}

module.exports = { initStore, saveSchema, saveSubmission, recentSchemas, source };
