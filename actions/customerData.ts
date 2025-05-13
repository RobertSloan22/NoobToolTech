import { Action, IAgentRuntime, Memory, State, stringToUuid } from "@elizaos/core";
import axios from "axios";
import * as jwt from 'jsonwebtoken';
import { getErrorMessage, formatApiErrorMessage, createErrorObject } from '../utils/errorHandling';

// Extract customer data from message content
function extractCustomerData(content: string): any {
    // Basic extraction logic
    const firstName = content.match(/first\s*name\s*:?\s*([a-zA-Z]+)/i)?.[1] 
        || content.match(/name\s*:?\s*([a-zA-Z]+)/i)?.[1] 
        || "Unknown";
    
    const lastNameMatch = content.match(/last\s*name\s*:?\s*([a-zA-Z]+)/i)?.[1] 
        || content.match(/(?:name|named)\s+[a-zA-Z]+\s+([a-zA-Z]+)/i)?.[1];
    const lastName = lastNameMatch || "Customer";
    
    // Extract email with regex that handles common email patterns
    const email = content.match(/email\s*:?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)?.[1] 
        || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
        
    // Extract phone with regex that handles common formats
    const phoneNumber = content.match(/phone\s*:?\s*(\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/i)?.[1] 
        || content.match(/phone\s*:?\s*([0-9]{10})/i)?.[1]
        || "000-000-0000";
    
    // Create customer object with default values for required fields
    return {
        firstName,
        lastName,
        email,
        phoneNumber,
        address: content.match(/address\s*:?\s*([^,]+)/i)?.[1] || "123 Main St",
        city: content.match(/city\s*:?\s*([a-zA-Z\s]+)/i)?.[1] || "Anytown",
        zipCode: content.match(/zip\s*:?\s*([0-9]{5}(?:-[0-9]{4})?)/i)?.[1] || "12345",
        notes: content.match(/notes\s*:?\s*([^,\.]+)/i)?.[1] || "",
        preferredContact: (
            content.includes("prefer email") ? "email" : 
            content.includes("prefer text") ? "text" : "phone"
        ) as 'email' | 'phone' | 'text',
        vehicles: []
    };
}

// Update the API configuration to use environment variables with fallbacks
const JWT_SECRET = process.env.JWT_SECRET || 'f9e0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api';

// Add axios instance with proper configuration
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 5000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    // Add retry logic
    validateStatus: (status) => status < 500
});

// Add request interceptor for auth
apiClient.interceptors.request.use(
    (config) => {
        // Get fresh token for each request
        const token = jwt.sign({ id: 'eliza-agent' }, JWT_SECRET, { expiresIn: '1h' });
        config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
    response => response,
    async error => {
        console.error('API request failed:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            error: error.message
        });

        if (error.code === 'ECONNREFUSED') {
            return Promise.resolve({ 
                data: [], // Return empty array as fallback
                status: 503,
                statusText: 'Service Unavailable'
            });
        }
        if (error.response?.status === 401) {
            console.error('Authentication failed');
            return Promise.resolve({ 
                data: [],
                status: 401,
                statusText: 'Unauthorized'
            });
        }
        return Promise.resolve({ 
            data: [],
            status: error.response?.status || 500,
            statusText: error.message
        });
    }
);

interface CustomerData {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    workphoneNumber?: number;
    address: string;
    city: string;
    zipCode: string;
    notes: string;
    preferredContact: 'email' | 'phone' | 'text';
    vehicles: Array<{
        year: number;
        make: string;
        model: string;
        trim?: string;
        vin?: string;
        licensePlate?: string;
        color?: string;
        mileage?: number;
        engine?: string;
        turbocharged?: boolean;
        transmission?: string;
        fuelType?: string;
        isAWD?: boolean;
        is4x4?: boolean;
        notes?: string;
        status?: string;
    }>;
}

// Helper function to safely create embeddings
async function createSafeEmbedding(runtime: IAgentRuntime, message: Memory, text: string, metadata = {}) {
    try {
        // Ensure we have non-empty text
        const safeText = text || 'No content available';
        
        const response = await runtime.messageManager.addEmbeddingToMemory({
            id: stringToUuid('embedding'),
            userId: message.userId,
            roomId: message.roomId,
            agentId: runtime.agentId,
            content: {
                text: safeText,
                metadata: {
                    ...metadata,
                    timestamp: Date.now()
                }
            },
            createdAt: Date.now()
        });

        // Verify we have a valid embedding
        if (!response?.embedding || response.embedding.length === 0) {
            console.warn('Empty embedding generated for text:', safeText);
            return null;
        }

        return response.embedding;
    } catch (error) {
        console.error('Failed to create embedding:', error);
        return null;
    }
}

export const customerDataAction: Action = {
    name: "CUSTOMER_DATA",
    similes: ["GET_CUSTOMER_DATA", "FETCH_CUSTOMER_DATA", "RETRIEVE_CUSTOMER_DATA"],
    description: "Retrieves and processes customer data based on various criteria",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        // Expand the validation patterns to catch more variations
        return text.includes("customer data") || 
               text.includes("get customer") || 
               text.includes("find customer") ||
               text.includes("search customer") ||
               text.includes("customer info") ||
               text.includes("customer information") ||
               // Add specific tool reference
               text.includes("customer data tool") ||
               text.includes("customer tool");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            // First try to get all customers if no specific search criteria
            const text = message.content.text?.toLowerCase() || '';
            let response;

            // Check for specific customer ID
            const customerId = text.match(/\b([0-9a-fA-F]{24})\b/)?.[1];
            if (customerId) {
                response = await apiClient.get(`/customers/${customerId}`);
            } 
            // Check for last name search
            else if (text.includes("last name")) {
                const lastName = text.replace(/.*last name\s+/i, '').trim();
                response = await apiClient.get(`/customers/search-by-lastname?lastName=${encodeURIComponent(lastName)}`);
            }
            // If no specific criteria, get all customers
            else {
                const searchTerm = text.replace(/customer data|get customer|find customer|search customer|customer tool|customer info/gi, '').trim();
                if (searchTerm) {
                    response = await apiClient.get(`/customers/search?q=${encodeURIComponent(searchTerm)}`);
                } else {
                    response = await apiClient.get('/customers/all');
                }
            }

            const customers = Array.isArray(response.data) ? response.data : [response.data];
            
            // Update state with customer data
            if (state) {
                state['customerData'] = customers;
                state['lastCustomerDataUpdate'] = Date.now();
            }

            const summaryText = `Found ${customers.length} customer(s)`;
            
            // Create embedding for the response
            const embedding = await createSafeEmbedding(runtime, message, summaryText, {
                type: 'customer-data',
                count: customers.length
            });

            await runtime.messageManager.createMemory({
                id: stringToUuid('customer-data-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embedding || undefined,  // Only include if we got a valid embedding
                content: {
                    text: `Customer Data Results:\n\n` +
                          customers.map(c => 
                            `- ${c.firstName} ${c.lastName}\n` +
                            `  Email: ${c.email}\n` +
                            `  Phone: ${c.phoneNumber}\n` +
                            `  Address: ${c.address}, ${c.city} ${c.zipCode}\n` +
                            `  Vehicles: ${c.vehicles.length}`
                          ).join('\n\n'),
                    metadata: {
                        type: 'customer-data',
                        count: customers.length,
                        timestamp: Date.now()
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing customer data:", error);
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Failed to process customer data: ${error.message}`,
                    metadata: { error: error.message }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Get customer data for John Smith" },
            },
            {
                user: "{{user2}}",
                content: { 
                    text: "Here is the customer data for John Smith",
                    action: "CUSTOMER_DATA"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Find customer with last name Johnson" },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here are all customers with last name Johnson",
                    action: "CUSTOMER_DATA"
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Get customer data for ID 507f1f77bcf86cd799439011" },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Here is the customer data for the specified ID",
                    action: "CUSTOMER_DATA"
                },
            },
        ],
    ],
};

export const getAllCustomersAction: Action = {
    name: "GET_ALL_CUSTOMERS",
    similes: ["LIST_CUSTOMERS", "FETCH_CUSTOMERS", "SHOW_CUSTOMERS"],
    description: "Fetches all customers from the database",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("get all customers") || text.includes("list customers") || text.includes("show customers");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const response = await apiClient.get<CustomerData[]>('/customers/all');
            const customers = response.data;

            const summaryText = `Found ${customers.length} customers in the database.`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('customers-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Retrieved ${customers.length} customers:\n\n` +
                          customers.map((c: any) => `- ${c.firstName} ${c.lastName} (${c.email})`).join('\n'),
                    metadata: {
                        type: 'customer-list',
                        count: customers.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing request:", error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Cannot connect to API server. Please ensure the server is running.';
            } else if (error.response) {
                errorMessage = `API error: ${error.response.status} - ${error.response.data?.message || error.message}`;
            } else if (error.request) {
                errorMessage = 'No response received from API server';
            } else {
                errorMessage = error.message;
            }

            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: errorMessage,
                    metadata: { 
                        error: error.message,
                        code: error.code,
                        type: 'api_error'
                    }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Show me all customers" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here are all the customers in the database", action: "GET_ALL_CUSTOMERS" },
            },
        ],
    ],
};

export const searchCustomersAction: Action = {
    name: "SEARCH_CUSTOMERS",
    similes: ["FIND_CUSTOMERS", "LOOKUP_CUSTOMERS"],
    description: "Searches for customers based on search criteria",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("search for customer") || text.includes("find customer") || text.includes("lookup customer");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text?.toLowerCase();
            const searchTerm = text.replace(/search for customer|find customer|lookup customer/gi, '').trim();

            const response = await apiClient.get(
                `/customers/search?q=${encodeURIComponent(searchTerm)}`
            );
            const customers = response.data;

            const summaryText = `Found ${customers.length} customers matching "${searchTerm}"`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('search-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Search Results for "${searchTerm}":\n\n` +
                          customers.map((c: any) => `- ${c.firstName} ${c.lastName} (${c.email})`).join('\n'),
                    metadata: {
                        type: 'customer-search',
                        searchTerm,
                        count: customers.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing request:", error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Cannot connect to API server. Please ensure the server is running.';
            } else if (error.response) {
                errorMessage = `API error: ${error.response.status} - ${error.response.data?.message || error.message}`;
            } else if (error.request) {
                errorMessage = 'No response received from API server';
            } else {
                errorMessage = error.message;
            }

            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: errorMessage,
                    metadata: { 
                        error: error.message,
                        code: error.code,
                        type: 'api_error'
                    }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Search for customer John" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here are the customers matching 'John'", action: "SEARCH_CUSTOMERS" },
            },
        ],
    ],
};

export const getCustomerVehiclesAction: Action = {
    name: "GET_CUSTOMER_VEHICLES",
    similes: ["LIST_CUSTOMER_VEHICLES", "SHOW_CUSTOMER_VEHICLES"],
    description: "Fetches all vehicles belonging to a specific customer",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("get customer vehicles") || text.includes("show customer vehicles");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text;
            const customerId = text.match(/\b([0-9a-fA-F]{24})\b/)?.[1];
            
            if (!customerId) {
                throw new Error("No customer ID provided in message");
            }

            const response = await apiClient.get(
                `/customers/${customerId}/vehicles`
            );
            const vehicles = response.data;

            const summaryText = `Found ${vehicles.length} vehicles for customer ID ${customerId}`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('vehicles-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Customer's Vehicles:\n\n` +
                          vehicles.map((v: any) => 
                            `- ${v.year} ${v.make} ${v.model}${v.vin ? ` (VIN: ${v.vin})` : ''}`
                          ).join('\n'),
                    metadata: {
                        type: 'customer-vehicles',
                        customerId,
                        count: vehicles.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing request:", error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Cannot connect to API server. Please ensure the server is running.';
            } else if (error.response) {
                errorMessage = `API error: ${error.response.status} - ${error.response.data?.message || error.message}`;
            } else if (error.request) {
                errorMessage = 'No response received from API server';
            } else {
                errorMessage = error.message;
            }

            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: errorMessage,
                    metadata: { 
                        error: error.message,
                        code: error.code,
                        type: 'api_error'
                    }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Show vehicles for customer 507f1f77bcf86cd799439011" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here are the customer's vehicles", action: "GET_CUSTOMER_VEHICLES" },
            },
        ],
    ],
};

export const getCustomerInvoicesAction: Action = {
    name: "GET_CUSTOMER_INVOICES",
    similes: ["LIST_CUSTOMER_INVOICES", "SHOW_CUSTOMER_INVOICES"],
    description: "Fetches all invoices belonging to a specific customer",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("get customer invoices") || text.includes("show customer invoices");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text;
            const customerId = text.match(/\b([0-9a-fA-F]{24})\b/)?.[1];
            
            if (!customerId) {
                throw new Error("No customer ID provided in message");
            }

            const response = await apiClient.get(
                `/customers/${customerId}/invoices`
            );
            const invoices = response.data;

            const summaryText = `Found ${invoices.length} invoices for customer ID ${customerId}`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('invoices-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Customer's Invoices:\n\n` +
                          invoices.map((inv: any) => 
                            `- Invoice #${inv.invoiceNumber}: $${inv.total} (${new Date(inv.date).toLocaleDateString()})`
                          ).join('\n'),
                    metadata: {
                        type: 'customer-invoices',
                        customerId,
                        count: invoices.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing request:", error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Cannot connect to API server. Please ensure the server is running.';
            } else if (error.response) {
                errorMessage = `API error: ${error.response.status} - ${error.response.data?.message || error.message}`;
            } else if (error.request) {
                errorMessage = 'No response received from API server';
            } else {
                errorMessage = error.message;
            }

            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: errorMessage,
                    metadata: { 
                        error: error.message,
                        code: error.code,
                        type: 'api_error'
                    }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Show invoices for customer 507f1f77bcf86cd799439011" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here are the customer's invoices", action: "GET_CUSTOMER_INVOICES" },
            },
        ],
    ],
};

export const searchCustomersByLastNameAction: Action = {
    name: "SEARCH_CUSTOMERS_BY_LASTNAME",
    similes: ["FIND_CUSTOMERS_BY_LASTNAME", "LOOKUP_CUSTOMERS_BY_LASTNAME"],
    description: "Searches for customers by last name",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("search customers by last name") || text.includes("find customers with last name");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text?.toLowerCase();
            const lastName = text.replace(/search customers by last name|find customers with last name/gi, '').trim();

            const response = await apiClient.get(
                `/customers/search-by-lastname?lastName=${encodeURIComponent(lastName)}`
            );
            const customers = response.data;

            const summaryText = `Found ${customers.length} customers with last name "${lastName}"`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('lastname-search-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Customers with last name "${lastName}":\n\n` +
                          customers.map((c: any) => `- ${c.firstName} ${c.lastName} (${c.email})`).join('\n'),
                    metadata: {
                        type: 'customer-lastname-search',
                        lastName,
                        count: customers.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error: any) {
            console.error("Error processing request:", error);
            let errorMessage = 'An unexpected error occurred';
            
            if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Cannot connect to API server. Please ensure the server is running.';
            } else if (error.response) {
                errorMessage = `API error: ${error.response.status} - ${error.response.data?.message || error.message}`;
            } else if (error.request) {
                errorMessage = 'No response received from API server';
            } else {
                errorMessage = error.message;
            }

            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: errorMessage,
                    metadata: { 
                        error: error.message,
                        code: error.code,
                        type: 'api_error'
                    }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Search customers by last name Smith" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here are the customers with last name 'Smith'", action: "SEARCH_CUSTOMERS_BY_LASTNAME" },
            },
        ],
    ],
};

export const createCustomerAction: Action = {
    name: "CREATE_CUSTOMER",
    similes: ["ADD_CUSTOMER", "NEW_CUSTOMER"],
    description: "Creates a new customer record",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("create customer") || text.includes("add customer") || text.includes("new customer");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const content = message.content.text;
            const customerData = extractCustomerData(content);

            const response = await apiClient.post('/customers', customerData);
            const newCustomer = response.data;

            const summaryText = `Created new customer: ${newCustomer.firstName} ${newCustomer.lastName}`;

            const embeddingResponse = await createSafeEmbedding(runtime, message, summaryText);

            await runtime.messageManager.createMemory({
                id: stringToUuid('create-customer-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse || undefined,
                content: {
                    text: `Successfully created new customer:\n` +
                          `- Name: ${newCustomer.firstName} ${newCustomer.lastName}\n` +
                          `- Email: ${newCustomer.email}\n` +
                          `- Phone: ${newCustomer.phoneNumber}\n`
                }
            });

            return true;
        } catch (error: any) {
            console.error("Error processing customer data:", error);
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Failed to process customer data: ${error.message}`,
                    metadata: { error: error.message }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Create customer John Doe" },
            },
            {
                user: "{{user2}}",
                content: { text: "Customer John Doe has been successfully created", action: "CREATE_CUSTOMER" },
            },
        ],
    ],
};