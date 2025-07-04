import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'bravo-1';

class Database {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(uri?: string): Promise<void> {
    try {
      const mongoUri = uri || MONGODB_URI;
      const dbName = process.env.DATABASE_NAME || DATABASE_NAME;
      this.client = new MongoClient(mongoUri);
      await this.client.connect();
      this.db = this.client.db(dbName);
      console.log(`Connected to MongoDB: ${dbName}`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  isConnected(): boolean {
    return this.db !== null;
  }
}

export const database = new Database();
