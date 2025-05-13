// Type definitions for custom errors
export interface ApiError extends Error {
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
  request?: any;
  code?: string;
}

// Module declarations for packages without type definitions
declare module 'better-sqlite3' {
  export default class Database {
    constructor(filename: string, options?: any);
    // Add minimal required methods
    prepare(sql: string): any;
    exec(sql: string): any;
    close(): void;
  }
}

// Default export to ensure this is treated as a module
export {}; 