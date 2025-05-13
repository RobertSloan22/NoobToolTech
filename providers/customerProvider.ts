import {
    type Provider,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    stringToUuid,
} from "@elizaos/core";

interface NamedProvider extends Provider {
    name: string;
}

const CUSTOMER_DATA_UPDATE_INTERVAL = 300000; // 5 minutes in milliseconds

export const customerProvider: NamedProvider = {
    name: "customer",
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const currentTime = Date.now();
            const lastUpdate = (state?.['lastCustomerDataUpdate'] as number) || 0;

            // Return cached data if available and not expired
            if (state?.['customerData'] && currentTime - lastUpdate < CUSTOMER_DATA_UPDATE_INTERVAL) {
                return state?.['customerData'];
            }

            // Create a memory to trigger the GET_ALL_CUSTOMERS action
            const actionMemory = {
                id: stringToUuid('get-customers'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: "get all customers",
                    action: "GET_ALL_CUSTOMERS"
                },
                createdAt: Date.now()
            };

            // Process the action
            await runtime.processActions(actionMemory, [], state);

            // Return the updated customer data from state
            return state?.['customerData'] || [];
        } catch (error) {
            elizaLogger.error("Error in customerProvider:", error);
            return state?.['customerData'] || [];
        }
    }
}; 