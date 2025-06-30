import { Client } from 'pg';

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'media_tool',
  user: 'postgres',
  password: 'postgres',
};

async function listTables() {
  const client = new Client(POSTGRES_CONFIG);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    console.log(`Database: ${POSTGRES_CONFIG.database}`);

    // List all schemas
    const schemas = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name
    `);

    console.log('\nSchemas in database:');
    schemas.rows.forEach((row) => console.log(`- ${row.schema_name}`));

    // List all tables in all schemas
    const result = await client.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    console.log('\nTables in database:');
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.table_schema}.${row.table_name}`);
    });

    console.log(`\nTotal tables: ${result.rows.length}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

listTables();
