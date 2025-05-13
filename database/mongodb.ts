// create a connection to the mongodb database that is running in a docker container locally on port 27017 using the connecton string MONGO_DB_URI=mongodb://localhost:27017/your_database_name

import mongoose from "mongoose";

// Define the types for the db connection 
type DbConnection = {
    connection: mongoose.Connection;
    db: mongoose.Mongoose;
}

class MongooseHandler {
    private static instance: MongooseHandler;
    private db: mongoose.Mongoose;

    private constructor() {
        this.db = mongoose;
    }

    public static getInstance(): MongooseHandler {
        if (!MongooseHandler.instance) {
            MongooseHandler.instance = new MongooseHandler();
        }
        return MongooseHandler.instance;
    }

    public getDb(): mongoose.Mongoose {
        return this.db;
    }
}

const connectToMongoDB = async (): Promise<DbConnection> => {
    try {
        // Check if MONGO_DB_URI is defined
        if (!process.env.MONGO_DB_URI) {
            throw new Error('MONGO_DB_URI is not defined in environment variables');
        }

        const handler = MongooseHandler.getInstance();
        const db = handler.getDb();
        
        const connection = await mongoose.connect(process.env.MONGO_DB_URI, {
            // Add mongoose connection options
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log("Successfully connected to MongoDB");
        
        // Handle connection errors
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        // Handle connection disconnection
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        return { connection: mongoose.connection, db };
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
};

export default connectToMongoDB;