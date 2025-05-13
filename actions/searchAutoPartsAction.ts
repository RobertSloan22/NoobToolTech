import { Action, IAgentRuntime, Memory, elizaLogger, Provider } from "@elizaos/core";
import automotivePartsProvider from "../providers/automotivePartsProvider.ts";
import oreillyAutoPartsProvider from "../providers/oreillyAutoPartsProvider.ts";
import repairLinkProvider from "../providers/repairLinkProvider.ts";

// Track if providers have been loaded
let providersLoaded = false;

// Interface to extend Provider with name property
interface NamedProvider extends Provider {
    name: string;
}

const searchAutoPartsAction: Action = {
    name: "SEARCH_AUTO_PARTS",
    similes: ["FIND_CAR_PART", "GET_AUTO_PARTS"],
    description: "Searches for automotive parts and provides pricing information.",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        
        // Only trigger when EXPLICITLY asking for parts search
        return (
            // Must include explicit indication of part search intent
            (
                text.includes("find part") || 
                text.includes("search for part") || 
                text.includes("look up part") || 
                text.includes("find a part") || 
                text.includes("search parts") || 
                text.includes("need a part") ||
                text.includes("get part") || 
                text.includes("check part") ||
                (text.includes("auto part") && (text.includes("search") || text.includes("find") || text.includes("look"))) ||
                (text.includes("car part") && (text.includes("search") || text.includes("find") || text.includes("look")))
            )
        );
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        // Lazy load the providers if this is the first time the action is triggered
        if (!providersLoaded) {
            elizaLogger.debug("First auto parts search request - lazy loading providers");
            
            // Safe type assertion as we know our providers have names
            const autoParts = automotivePartsProvider as NamedProvider;
            const oreillyParts = oreillyAutoPartsProvider as NamedProvider;
            const repairLink = repairLinkProvider as NamedProvider;
            
            // Check if providers are already registered to avoid duplicates
            const hasAutomotiveProvider = runtime.providers.some(p => 
                (p as NamedProvider).name === autoParts.name
            );
            
            const hasOreillyProvider = runtime.providers.some(p => 
                (p as NamedProvider).name === oreillyParts.name
            );
            
            const hasRepairLinkProvider = runtime.providers.some(p => 
                (p as NamedProvider).name === repairLink.name
            );
            
            // Register providers if not already present
            if (!hasAutomotiveProvider) {
                elizaLogger.debug("Adding automotive parts provider");
                runtime.providers.push(automotivePartsProvider);
            }
            
            if (!hasOreillyProvider) {
                elizaLogger.debug("Adding O'Reilly auto parts provider");
                runtime.providers.push(oreillyAutoPartsProvider);
            }
            
            if (!hasRepairLinkProvider) {
                elizaLogger.debug("Adding RepairLink provider");
                runtime.providers.push(repairLinkProvider);
            }
            
            providersLoaded = true;
            elizaLogger.debug("Auto parts providers loaded successfully");
            
            // Give a small delay for providers to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Now that providers are loaded, perform the search
        elizaLogger.debug("Searching for auto parts");
        const results = await automotivePartsProvider.get(runtime, message);
        await runtime.messageManager.createMemory({
            id: message.id,
            content: { text: results },
            userId: runtime.agentId,
            agentId: runtime.agentId,
            roomId: message.roomId,
        });
        return true;
    },

    examples: [
        [
            { user: "{{user1}}", content: { text: "Find me a brake pad for Toyota Corolla 2020" } },
            { user: "{{user2}}", content: { text: "Sure! Searching for Toyota Corolla 2020 brake pad..." } }
        ]
    ]
};

export default searchAutoPartsAction;
