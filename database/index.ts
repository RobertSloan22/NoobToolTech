import { PostgresDatabaseAdapter } from "@elizaos/adapter-postgres";
import { SqliteDatabaseAdapter } from "@elizaos/adapter-sqlite";
import Database from "better-sqlite3";
import { MongoDBDatabaseAdapter } from "@elizaos/adapter-mongodb";
import path from "path";
import { MongoClient } from 'mongodb';

export function initializeDatabase(dataDir: string) {
  if (process.env.POSTGRES_URL) {
    const db = new PostgresDatabaseAdapter({
      connectionString: process.env.POSTGRES_URL,
    });
    return db;
  } else if (process.env.MONGODB_URL) {
    const db = new MongoDBDatabaseAdapter(
      new MongoClient(process.env.MONGODB_URL),
      process.env.MONGODB_DATABASE ?? "eliza"
    );
    return db;
  } else {
    const filePath =
      process.env.SQLITE_FILE ?? path.resolve(dataDir, "db.sqlite");
    // ":memory:";
    const db = new SqliteDatabaseAdapter(new Database(filePath));
    return db;
  }
}
