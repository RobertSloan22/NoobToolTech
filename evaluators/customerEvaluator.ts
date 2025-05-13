import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";

interface CustomerQuery {
    keywords: string[];
    action: string;
    description: string;
}

const CUSTOMER_QUERIES: Record<string, CustomerQuery> = {
    search: {
        keywords: ['search', 'find', 'lookup', 'get'],
        action: 'SEARCH_CUSTOMERS',
        description: 'Search for customers'
    },
    list: {
        keywords: ['list', 'show', 'all'],
        action: 'GET_ALL_CUSTOMERS',
        description: 'List all customers'
    },
    vehicles: {
        keywords: ['vehicles', 'cars', 'automobile'],
        action: 'GET_CUSTOMER_VEHICLES',
        description: 'Get customer vehicles'
    },
    create: {
        keywords: ['create', 'add', 'new'],
        action: 'CREATE_CUSTOMER',
        description: 'Create new customer'
    },
    update: {
        keywords: ['update', 'modify', 'edit', 'change'],
        action: 'UPDATE_CUSTOMER',
        description: 'Update customer information'
    }
};

export const customerEvaluator: Evaluator = {
    alwaysRun: false,
    description: "Evaluates customer-related queries and manages customer data operations",
    similes: ["customer data manager", "customer information handler"],
    examples: [
        {
            context: "Handling customer search request",
            messages: [
                {
                    user: "system",
                    content: {
                        text: "search for customer John Smith",
                    }
                }
            ],
            outcome: "Trigger customer search action",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            const metadata = memory.content?.metadata as { type?: string } || {};

            // Get customer provider
            const customerProvider = runtime.providers.find(provider =>
                (provider as any).name === "customerProvider");
            const customerData = customerProvider ? await customerProvider.get(runtime, memory, state) : null;

            // Handle specific customer queries
            for (const [category, query] of Object.entries(CUSTOMER_QUERIES)) {
                if (query.keywords.some(k => text.includes(k)) && text.includes('customer')) {
                    return {
                        score: 0.9,
                        reason: query.description,
                        action: query.action
                    };
                }
            }

            // Handle customer data display if we have data
            if (customerData && text.includes('customer')) {
                return {
                    score: 0.7,
                    reason: "General customer query",
                    data: [
                        `Total Customers: ${customerData.length}`,
                        `Recent Customers: ${customerData.slice(0, 5).map((c: any) =>
                            `${c.firstName} ${c.lastName} (${c.email})`).join(', ')}`
                    ]
                };
            }

            return {
                score: 0,
                reason: "Not a customer-related query",
            };
        } catch (error) {
            elizaLogger.error("Error in customerEvaluator:", error);
            return {
                score: 0,
                reason: "Error evaluating customer query",
            };
        }
    },
    name: "customerEvaluator",
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
        const text = memory.content?.text?.toLowerCase() || "";
        return text.includes('customer') || 
               Object.values(CUSTOMER_QUERIES)
                   .some(query => query.keywords.some(k => text.includes(k)));
    },
}; 