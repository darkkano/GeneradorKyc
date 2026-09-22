const { mysqlTable, varchar, int, text, longtext, timestamp, index } = require('drizzle-orm/mysql-core');

const formSchemas = mysqlTable(
  'form_schemas',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    country: varchar('country', { length: 8 }).notNull(),
    risk: varchar('risk', { length: 8 }).notNull(),
    activity: varchar('activity', { length: 24 }).notNull(),
    volumeUsd: int('volume_usd').notNull(),
    prompt: text('prompt').notNull(),
    rationale: text('rationale').notNull(),
    schemaJson: longtext('schema_json').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({ countryRisk: index('idx_form_schemas_country_risk').on(t.country, t.risk) }),
);

const submissions = mysqlTable(
  'submissions',
  {
    id: varchar('id', { length: 40 }).primaryKey(),
    schemaId: varchar('schema_id', { length: 40 }).notNull(),
    country: varchar('country', { length: 8 }).notNull(),
    risk: varchar('risk', { length: 8 }).notNull(),
    payload: longtext('payload').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({ schemaIdx: index('idx_submissions_schema').on(t.schemaId) }),
);

module.exports = { formSchemas, submissions };
