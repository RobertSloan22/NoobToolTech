import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { elizaLogger } from '@elizaos/core';
import type { AgentRuntime } from '@elizaos/core';

// Define extended interfaces to handle missing properties in the core types
interface ExtendedAgentRuntime extends AgentRuntime {
  sendMessage?: (message: string, conversationId?: string) => Promise<any>;
  startConversation?: () => Promise<{ id: string }>;
}

interface ExtendedDatabaseAdapter {
  getMessagesByConversationId?: (conversationId: string) => Promise<any[]>;
}

interface ExtendedCharacter {
  description?: string;
}

/**
 * Creates and configures an Express app for the Eliza HTTP API
 * @param agents - The Eliza agent runtimes
 * @param port - The port to run the server on
 * @returns The configured Express app
 */
export function createHttpApi(agents: AgentRuntime[], port: number) {
  const app = express();
  
  // Configure middleware
  app.use(cors());
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
  
  // Basic health check endpoint
  app.get('/', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Eliza HTTP API is running',
      version: '1.0.0'
    });
  });
  
  // Get all available agents
  app.get('/agents', (req, res) => {
    try {
      const agentList = agents.map(agent => {
        // Use type assertion to safely access description
        const extendedCharacter = agent.character as unknown as ExtendedCharacter;
        
        return {
          id: agent.agentId,
          name: agent.character.name,
          description: extendedCharacter.description || 'No description available'
        };
      });
      
      res.json({ agents: agentList });
    } catch (error) {
      elizaLogger.error(`Error getting agent list: ${error.message}`);
      res.status(500).json({ error: 'Failed to get agent list' });
    }
  });
  
  // Get a specific agent by ID
  app.get('/agent/:agentId', (req, res) => {
    try {
      const { agentId } = req.params;
      const agent = agents.find(a => a.agentId === agentId);
      
      if (!agent) {
        return res.status(404).json({ error: `Agent with ID ${agentId} not found` });
      }
      
      // Use type assertion to safely access description
      const extendedCharacter = agent.character as unknown as ExtendedCharacter;
      
      res.json({
        id: agent.agentId,
        name: agent.character.name,
        description: extendedCharacter.description || 'No description available',
        modelProvider: agent.character.modelProvider
      });
    } catch (error) {
      elizaLogger.error(`Error getting agent: ${error.message}`);
      res.status(500).json({ error: 'Failed to get agent information' });
    }
  });
  
  // Send a message to an agent
  app.post('/agent/:agentId/message', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { message, conversationId } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      const agent = agents.find(a => a.agentId === agentId);
      
      if (!agent) {
        return res.status(404).json({ error: `Agent with ID ${agentId} not found` });
      }
      
      // Use type assertion to access sendMessage method
      const extendedAgent = agent as unknown as ExtendedAgentRuntime;
      
      // Check if runtime has the sendMessage method
      if (typeof extendedAgent.sendMessage !== 'function') {
        return res.status(500).json({ 
          error: 'Agent does not support direct messaging',
          message: 'The agent runtime does not have a sendMessage method'
        });
      }
      
      // Send the message to the agent
      const response = await extendedAgent.sendMessage(message, conversationId);
      
      res.json({
        response,
        conversationId: response.conversationId || conversationId
      });
    } catch (error) {
      elizaLogger.error(`Error sending message to agent: ${error.message}`);
      res.status(500).json({ error: 'Failed to send message to agent' });
    }
  });
  
  // Get conversation history
  app.get('/agent/:agentId/conversations/:conversationId', async (req, res) => {
    try {
      const { agentId, conversationId } = req.params;
      
      const agent = agents.find(a => a.agentId === agentId);
      
      if (!agent) {
        return res.status(404).json({ error: `Agent with ID ${agentId} not found` });
      }
      
      // Use type assertion for database adapter
      const databaseAdapter = agent.databaseAdapter as unknown as ExtendedDatabaseAdapter;
      
      // Check if agent has database adapter with getMessagesByConversationId
      if (!databaseAdapter || typeof databaseAdapter.getMessagesByConversationId !== 'function') {
        return res.status(500).json({ 
          error: 'Agent does not support conversation history retrieval'
        });
      }
      
      // Get the messages for the conversation
      const messages = await databaseAdapter.getMessagesByConversationId(conversationId);
      
      res.json({
        conversationId,
        messages: messages.map(m => ({
          id: m.id,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp
        }))
      });
    } catch (error) {
      elizaLogger.error(`Error getting conversation history: ${error.message}`);
      res.status(500).json({ error: 'Failed to get conversation history' });
    }
  });
  
  // Start a new conversation with an agent
  app.post('/agent/:agentId/conversations', async (req, res) => {
    try {
      const { agentId } = req.params;
      const { initialMessage } = req.body;
      
      const agent = agents.find(a => a.agentId === agentId);
      
      if (!agent) {
        return res.status(404).json({ error: `Agent with ID ${agentId} not found` });
      }
      
      // Use type assertion to access startConversation method
      const extendedAgent = agent as unknown as ExtendedAgentRuntime;
      
      // Check if runtime has the startConversation method
      if (typeof extendedAgent.startConversation !== 'function') {
        return res.status(500).json({ 
          error: 'Agent does not support starting new conversations via API'
        });
      }
      
      // Start a new conversation
      const conversation = await extendedAgent.startConversation();
      
      // If there's an initial message, send it
      let response = null;
      if (initialMessage && typeof extendedAgent.sendMessage === 'function') {
        response = await extendedAgent.sendMessage(initialMessage, conversation.id);
      }
      
      res.json({
        conversationId: conversation.id,
        initialResponse: response
      });
    } catch (error) {
      elizaLogger.error(`Error starting conversation: ${error.message}`);
      res.status(500).json({ error: 'Failed to start conversation' });
    }
  });
  
  // Start the server
  const server = app.listen(port, () => {
    elizaLogger.success(`Eliza HTTP API server running on port ${port}`);
    elizaLogger.log(`API endpoints available at http://localhost:${port}/`);
  });
  
  return { app, server };
} 