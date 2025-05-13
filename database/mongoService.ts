import mongoose from 'mongoose';

export class MongoService {
  private connection: mongoose.Connection;
  
  constructor(connection: mongoose.Connection) {
    this.connection = connection;
  }

  // Example methods for your agent to use
  async saveConversation(conversationData: any) {
    const Conversation = this.connection.model('Conversation', new mongoose.Schema({
      agentId: String,
      timestamp: Date,
      content: Object,
      metadata: Object
    }));

    return await new Conversation(conversationData).save();
  }

  async saveVehicleData(vehicleData: any) {
    const Vehicle = this.connection.model('Vehicle', new mongoose.Schema({
      vin: String,
      data: Object,
      timestamp: Date
    }));

    return await new Vehicle(vehicleData).save();
  }

  async findConversations(query: any) {
    const Conversation = this.connection.model('Conversation');
    return await Conversation.find(query).exec();
  }

  // Add more methods as needed for your specific use case
} 