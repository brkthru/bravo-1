import { database } from '../config/database';

jest.setTimeout(60000);

// Set test database name
process.env.MONGODB_DATABASE = 'mediatool_test';

// Clean up database connection after all tests
afterAll(async () => {
  if (database.isConnected()) {
    await database.disconnect();
  }
});