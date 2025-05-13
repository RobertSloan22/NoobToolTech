import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
  type Service,
  ServiceType,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";

import { solanaPlugin } from "@elizaos/plugin-solana";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character as baseCharacter } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";
import { vehicleEvaluator } from "./evaluators/vehicleEvaluator.ts";
import { vehicleProvider } from "./providers/vehicleProvder.ts";
import { fetchVehicleDataAction, createCustomerAction, getAllCustomersAction, searchCustomersByLastNameAction } from "./actions/index.ts";
import { customerProvider } from "./providers/customerProvider.ts";
import { customerEvaluator } from "./evaluators/customerEvaluator.ts";
import { fetchLatestLogsAction } from "./actions/latestLogs.ts";
import { maintenanceEvaluator } from "./evaluators/maintenanceEvaluator.ts";
import { webSearchPlugin } from "@elizaos/plugin-web-search";
import http from "http";
import https from "https";
import bodyParser from 'body-parser';
// Import the HTTP API
import { createHttpApi } from "./api/http.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Override the stringToUuid function to always return our fixed ID
// This is a more aggressive approach to ensure the agent ID is always correct
const originalStringToUuid = stringToUuid;
(global as any).stringToUuid = function() {
  elizaLogger.debug(`Overriding stringToUuid to use fixed ID: ${FIXED_AGENT_ID}`);
  return FIXED_AGENT_ID;
};

// Fix the type definition for the fixed ID
const FIXED_AGENT_ID = "eliza-0000-0000-0000-000000000000" as `${string}-${string}-${string}-${string}-${string}`;

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

let nodePlugin: any | undefined;

// Define Settings interface
interface Settings {
  secrets?: { [key: string]: string };
}

// Update character type
const character = baseCharacter as Character;

export function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name,
  );

  nodePlugin ??= createNodePlugin();

  // Initialize settings if needed
  if (!character.settings) {
    character.settings = {
      secrets: {}
    };
  }

  // Ensure character ID is the fixed ID
  character.id = FIXED_AGENT_ID;

  const runtime = new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [vehicleEvaluator, customerEvaluator, maintenanceEvaluator],
    character,
    plugins: [
      bootstrapPlugin,
      nodePlugin,
      webSearchPlugin,      
      character.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [
      vehicleProvider,
      customerProvider,
    ],
    actions: [
      fetchVehicleDataAction, 
      fetchLatestLogsAction,
      createCustomerAction,
      getAllCustomersAction,
      searchCustomersByLastNameAction,
    ],
    services: [
    ],
    managers: [],
    cacheManager: cache,
  });

  // Explicitly set the agent ID to our fixed ID
  // Use type assertion to bypass TypeScript checks
  try {
    if (runtime.agentId !== FIXED_AGENT_ID) {
      (runtime as any).agentId = FIXED_AGENT_ID;
      elizaLogger.debug(`Set runtime.agentId to fixed ID: ${FIXED_AGENT_ID}`);
    }
  } catch (e) {
    elizaLogger.warn(`Could not set runtime.agentId: ${e.message}`);
  }

  return runtime;
}

// Add a more complete in-memory database implementation
const createInMemoryDb = () => {
  const data = new Map();
  const memories = new Map();
  const embeddings = new Map();
  
  return {
    init: async () => Promise.resolve(),
    get: (key: string) => data.get(key),
    set: (key: string, value: any) => {
      data.set(key, value);
      return Promise.resolve();
    },
    delete: (key: string) => {
      data.delete(key);
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
    query: () => Promise.resolve([]),
    exec: () => Promise.resolve(),
    
    // Memory management methods
    getMemoryById: async (id) => memories.get(id) || null,
    getAllMemories: async () => Array.from(memories.values()),
    createMemory: async (memory) => {
      memories.set(memory.id, memory);
      return memory;
    },
    updateMemory: async (memory) => {
      memories.set(memory.id, memory);
      return memory;
    },
    deleteMemory: async (id) => {
      memories.delete(id);
      return true;
    },
    searchMemories: async () => [],
    
    // Embedding methods
    getCachedEmbeddings: async (text) => embeddings.get(text),
    setCachedEmbeddings: async (text, embedding) => {
      embeddings.set(text, embedding);
      return true;
    },
    
    // Additional methods that might be required
    getConversationsByCharacterId: async () => [],
    createConversation: async (conversation) => conversation,
    getConversation: async () => null,
    updateConversation: async (conversation) => conversation,
    getMessagesByConversationId: async () => [],
    createMessage: async (message) => message,
    getCharacterById: async (id) => null,
    createCharacter: async (character) => character,
    updateCharacter: async (character) => character
  };
};

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    // Force the character ID
    character.id = FIXED_AGENT_ID;
    character.username ??= character.name;

    elizaLogger.debug(`Setting fixed ID for character ${character.name}: ${FIXED_AGENT_ID}`);

    const token = getTokenForProvider(character.modelProvider, character);
    elizaLogger.debug(`Got token for ${character.name} with provider ${character.modelProvider}`);
    
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    let db;
    try {
      elizaLogger.debug(`Initializing database in ${dataDir}`);
      db = initializeDatabase(dataDir);
      await db.init();
      elizaLogger.debug(`Database initialized successfully`);
    } catch (dbError) {
      elizaLogger.warn(
        `Failed to initialize SQLite database: ${dbError.message || dbError}. Falling back to in-memory storage.`
      );
      elizaLogger.debug(`Database error stack: ${dbError.stack}`);
      db = createInMemoryDb();
    }

    const cache = initializeDbCache(character, db);
    elizaLogger.debug(`Cache initialized for ${character.name}`);
    
    try {
      elizaLogger.debug(`Creating agent runtime for ${character.name} with fixed ID: ${FIXED_AGENT_ID}`);
      // Fix for the linter error: Ensure token is a string
      const actualToken = token || "";
      
      // Create the runtime with modified configuration
      const runtime = createAgent(character, db, cache, actualToken);
      
      // After runtime initialization, force the agentId again
      await runtime.initialize();
      
      // Attempt to force the ID after initialization
      forceAgentId(runtime, FIXED_AGENT_ID);
      
      elizaLogger.debug(`Initializing clients for ${character.name}`);
      runtime.clients = await initializeClients(character, runtime);
      
      elizaLogger.debug(`Registering agent ${character.name} with direct client`);
      // Check actual ID before registering
      elizaLogger.debug(`Current runtime agentId: ${runtime.agentId}`);
      
      // For the DirectClient, we need to use a monkey patch approach
      // to ensure our agent is registered with the fixed ID
      const originalRegisterAgent = directClient.registerAgent;
      directClient.registerAgent = function(agent) {
        // Force the agent ID before registration
        elizaLogger.debug(`Setting fixed ID before registration: ${FIXED_AGENT_ID}`);
        // Use type assertion to bypass TypeScript checks
        (agent as any).agentId = FIXED_AGENT_ID;
        // Call original function with fixed ID
        return originalRegisterAgent.call(this, agent);
      };
      
      directClient.registerAgent(runtime);
      
      // Restore original function
      directClient.registerAgent = originalRegisterAgent;
      
      // report to console
      elizaLogger.success(`Started ${character.name} with forced ID: ${FIXED_AGENT_ID}`);
      return runtime;
    } catch (runtimeError) {
      elizaLogger.error(`Runtime initialization error for ${character.name}:`);
      elizaLogger.error(runtimeError.stack || runtimeError.toString());
      throw runtimeError;
    }
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`);
    elizaLogger.error(error.stack || error.toString());
    throw error;
  }
}

// Helper function to force agent ID
function forceAgentId(runtime: AgentRuntime, id: string) {
  try {
    // Try multiple approaches to ensure the ID is set
    // 1. Direct assignment with type casting to bypass TypeScript checks
    (runtime as any).agentId = id;
    
    // 2. Try using defineProperty if available
    try {
      Object.defineProperty(runtime, 'agentId', {
        value: id,
        writable: true,
        configurable: true
      });
    } catch (e) {
      elizaLogger.debug(`defineProperty approach failed: ${e.message}`);
    }
    
    // Remove references to non-existent properties and methods
    
    // Log the result
    elizaLogger.debug(`Agent ID after force attempts: ${runtime.agentId}`);
    
    return runtime.agentId === id;
  } catch (error) {
    elizaLogger.warn(`Error forcing agent ID: ${error.message}`);
    return false;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

// Helper function to check DirectClient instance
function validateDirectClient(client: DirectClient): string | null {
  if (!client) return "DirectClient is null or undefined";
  
  // Check for required methods
  if (typeof client.start !== 'function') return "DirectClient.start is not a function";
  if (typeof client.registerAgent !== 'function') return "DirectClient.registerAgent is not a function";
  
  return null; // No errors found
}

const startAgents = async () => {
  try {
    const directClient = new DirectClient();
    
    // Add this to force registration with fixed ID
    elizaLogger.debug(`Configuring DirectClient to use fixed agent ID: ${FIXED_AGENT_ID}`);
    
    // Validate DirectClient instance
    const clientError = validateDirectClient(directClient);
    if (clientError) {
      elizaLogger.error(`DirectClient validation error: ${clientError}`);
      throw new Error(clientError);
    }
    
    let serverPort = parseInt(settings.SERVER_PORT || "3005");
    const args = parseArguments();

    // Configure global HTTP and HTTPS agents with longer timeouts
    http.globalAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 100,
      timeout: 60000, // 60 seconds
    });
    
    https.globalAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 100,
      timeout: 60000, // 60 seconds
    });

    // Increase Node.js default timeout
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Only use in dev environments
    
    // Increase default max HTTP header size to handle larger requests
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --max-http-header-size=32768`;

    let charactersArg = args.characters || args.character;
    let characters: Character[] = [character];
    
    elizaLogger.debug(`Starting with character config: ${JSON.stringify(character.name)}`);
    
    if (charactersArg) {
      try {
        elizaLogger.debug(`Loading characters from: ${charactersArg}`);
        characters = await loadCharacters(charactersArg);
        elizaLogger.debug(`Loaded ${characters.length} characters`);
      } catch (loadError) {
        elizaLogger.error(`Error loading characters: ${loadError.message || loadError}`);
        elizaLogger.debug(`Falling back to default character`);
        // Continue with default character
      }
    }

    // Store successfully started agents
    const startedAgents: AgentRuntime[] = [];

    // If there are multiple characters, pick the first one for our fixed ID agent
    let mainCharacter = characters[0];
    
    elizaLogger.debug(`Using character "${mainCharacter.name}" for fixed agent ID: ${FIXED_AGENT_ID}`);
    
    try {
      // Start only the main character with fixed ID
      elizaLogger.debug(`Attempting to start agent with fixed ID: ${FIXED_AGENT_ID}`);
      
      try {
        const agent = await startAgent(mainCharacter, directClient as DirectClient);
        if (agent) {
          startedAgents.push(agent);
          elizaLogger.success(`Successfully started agent "${mainCharacter.name}" with fixed ID: ${FIXED_AGENT_ID}`);
        }
      } catch (individualError) {
        elizaLogger.error(`Failed to start agent with fixed ID: ${FIXED_AGENT_ID}`);
        elizaLogger.error(individualError.stack || individualError.toString());
        // Try with default character if custom character fails
        if (mainCharacter !== character) {
          elizaLogger.debug(`Falling back to default character for fixed agent ID`);
          try {
            const agent = await startAgent(character, directClient as DirectClient);
            if (agent) {
              startedAgents.push(agent);
              elizaLogger.success(`Successfully started default agent with fixed ID: ${FIXED_AGENT_ID}`);
            }
          } catch (fallbackError) {
            elizaLogger.error(`Failed to start default agent with fixed ID: ${FIXED_AGENT_ID}`);
            elizaLogger.error(fallbackError.stack || fallbackError.toString());
          }
        }
      }
      
      // Only proceed if we have at least one agent
      if (startedAgents.length === 0) {
        throw new Error("No agents were successfully started. Exiting.");
      }
      
      // Removed code for starting additional agents with different IDs
      // We now only use the fixed ID agent
      
    } catch (agentLoopError) {
      elizaLogger.error("Error in agent startup loop:");
      elizaLogger.error(agentLoopError.stack || agentLoopError.toString());
      // Continue if at least one agent started
    }

    // Only proceed if we have at least one agent
    if (startedAgents.length === 0) {
      throw new Error("No agents were successfully started. Exiting.");
    }

    let portAvailable = false;
    let portAttempts = 0;
    const maxPortAttempts = 10;
    
    while (!portAvailable && portAttempts < maxPortAttempts) {
      try {
        portAvailable = await checkPortAvailable(serverPort);
        if (!portAvailable) {
          elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
          serverPort++;
          portAttempts++;
        }
      } catch (portError) {
        elizaLogger.error(`Error checking port availability: ${portError.message || portError}`);
        serverPort++; // Try next port
        portAttempts++;
      }
    }
    
    if (portAttempts >= maxPortAttempts) {
      throw new Error(`Could not find available port after ${maxPortAttempts} attempts`);
    }

    // upload some agent functionality into directClient
    directClient.startAgent = async (character: Character) => {
      // wrap it so we don't have to inject directClient later
      return startAgent(character, directClient);
    };
    
    // Set proxy environment variables if running behind a proxy
    if (process.env.RUNNING_BEHIND_PROXY === 'true') {
      process.env.SERVER_PORT = serverPort.toString();
      elizaLogger.log(`Running behind proxy. Setting SERVER_PORT to ${serverPort}`);
      
      // Apply specific proxy-friendly configurations
      process.env.SERVER_TIMEOUT = '120000'; // 2 minutes timeout
      process.env.MAX_PAYLOAD_SIZE = '52428800'; // 50MB max payload (in bytes)
    }

    // Start the DirectClient server
    const directServer = directClient.start(serverPort);
    
    // Setup HTTP API server on a separate port
    let httpPort = serverPort + 1;
    
    // Check if HTTP port is available
    let httpPortAvailable = await checkPortAvailable(httpPort);
    let httpPortAttempts = 0;
    
    while (!httpPortAvailable && httpPortAttempts < maxPortAttempts) {
      httpPort++;
      httpPortAvailable = await checkPortAvailable(httpPort);
      httpPortAttempts++;
    }
    
    if (httpPortAttempts >= maxPortAttempts) {
      elizaLogger.warn(`Could not find available port for HTTP API after ${maxPortAttempts} attempts. HTTP API will not be started.`);
    } else {
      // Create and start the HTTP API
      elizaLogger.debug(`Starting HTTP API on port ${httpPort}`);
      const httpApi = createHttpApi(startedAgents, httpPort);
      
      elizaLogger.success(`HTTP API started on port ${httpPort}`);
      elizaLogger.log(`API accessible at http://localhost:${httpPort}/`);
      elizaLogger.log(`To test, visit http://localhost:${httpPort}/agents to see available agents`);
      elizaLogger.log(`To interact with an agent, use http://localhost:${httpPort}/agent/${FIXED_AGENT_ID}`);
    }
    
    // Log the fixed agent ID for clarity
    elizaLogger.log(`Server started with fixed agent ID: ${FIXED_AGENT_ID}`);
    elizaLogger.log(`DirectClient connects to agent ${FIXED_AGENT_ID} on port ${serverPort}`);
    elizaLogger.log(`HTTP API (if available) connects to agent ${FIXED_AGENT_ID} on port ${httpPort}`);
    
    // Add global error handling for uncaught exceptions
    process.on('uncaughtException', (error) => {
      if (error && error.message && error.message.includes('request aborted')) {
        elizaLogger.debug('Caught uncaught "request aborted" exception, handling gracefully');
        // Don't exit for request aborted errors
        return;
      }
      
      // Log but don't crash for other errors
      elizaLogger.error(`Uncaught exception: ${error.message || error}`);
      if (error.stack) {
        elizaLogger.error(`Stack trace: ${error.stack}`);
      }
    });
    
    // Add global rejection handling
    process.on('unhandledRejection', (reason, promise) => {
      elizaLogger.error(`Unhandled rejection at:`, promise);
      elizaLogger.error(`Reason: ${reason}`);
    });
    
    // Wait a moment to ensure servers are fully started
    await new Promise(resolve => setTimeout(resolve, 1000));

    const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
    if(!isDaemonProcess) {
      elizaLogger.log(`Chat started with ${startedAgents.length} agent(s). Type 'exit' to quit.`);
      const chat = startChat(characters);
      chat();
    }
    
    return { port: serverPort, httpPort, agents: startedAgents }; // Return useful information
  } catch (error) {
    // This catch block will handle any error from the entire function
    elizaLogger.error(`Fatal error in startAgents: ${error.message || error}`);
    if (error.stack) {
      elizaLogger.error(`Stack trace: ${error.stack}`);
    }
    throw error; // Re-throw to be caught by the .catch() handler
  }
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:");
  
  // Better error handling for empty error objects
  if (!error || Object.keys(error).length === 0) {
    elizaLogger.error("Empty error object received. Stack trace:");
    elizaLogger.error(new Error().stack);
    
    // Check for Node.js warnings
    const warnings = process.listeners('warning');
    if (warnings.length > 0) {
      elizaLogger.error("Possible warnings detected. Please check Node.js warnings.");
    }
  } else {
    // Log error details
    elizaLogger.error(`Error message: ${error.message || 'No message'}`);
    elizaLogger.error(`Error name: ${error.name || 'No name'}`);
    elizaLogger.error(`Stack trace: ${error.stack || 'No stack trace'}`);
  }
  
  // Log additional debug information
  elizaLogger.debug("Server port: " + settings.SERVER_PORT);
  elizaLogger.debug("Node.js version: " + process.version);
  elizaLogger.debug("Memory usage: " + JSON.stringify(process.memoryUsage()));
  
  process.exit(1);
});

