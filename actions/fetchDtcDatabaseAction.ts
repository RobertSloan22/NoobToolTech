import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";
import { formatApiErrorMessage } from '../utils/errorHandling';

/**
 * This action fetches diagnostic trouble code (DTC) information when 
 * a DTC code is detected in the conversation.
 */
export const fetchDtcDatabaseAction: Action = {
    name: "FETCH_DTC_DATABASE",
    description: "Fetches information about diagnostic trouble codes from the DTC database",
    similes: ["DTC lookup tool", "diagnostic code reference", "vehicle code interpreter"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "What does code P0420 mean?" }
            },
            {
                user: "{{user2}}",
                content: { 
                    text: "P0420 is a diagnostic trouble code for 'Catalyst System Efficiency Below Threshold (Bank 1)'. This means your catalytic converter isn't functioning correctly.",
                    action: "FETCH_DTC_DATABASE"
                }
            }
        ]
    ],
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
        // Check for DTC codes in state using "as any" for type safety
        const dtcEvaluation = state ? (state as any).lastDtcEvaluation : undefined;
        return !!dtcEvaluation?.dtcCodes?.length;
    },
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
        try {
            // Get DTC codes from evaluator data if available
            const dtcEvaluatorData = state ? (state as any).lastDtcEvaluation : undefined;
            if (!dtcEvaluatorData?.dtcCodes?.length) {
                return {
                    output: "I need a valid diagnostic trouble code (DTC) to provide information. Please provide a code in the format P0123, B0123, C0123, or U0123.",
                    state: state || {} as State
                };
            }

            // Extract codes from the evaluator data
            const dtcCodes = dtcEvaluatorData.dtcCodes;
            
            // Call the DTC Database Provider - using providers interface correctly
            const dtcCodeText = dtcCodes.map((c: { code: string }) => c.code).join(', ');
            let providerResponse;
            
            // Instead of runtime.providers.dtcDatabaseProvider, find the provider by name
            const dtcProvider = runtime.providers.find(p => (p as any).name === "dtcDatabaseProvider");
            if (!dtcProvider) {
                return {
                    output: `I couldn't access the DTC database provider. Please try again later.`,
                    state: state || {} as State
                };
            }
            
            const result = await dtcProvider.get(runtime, memory, state);
            providerResponse = result;
            
            // Store DTC database response in state for future reference
            const updatedState = {
                ...state,
                lastDtcLookup: {
                    codes: dtcCodes.map((c: { code: string }) => c.code),
                    timestamp: new Date().toISOString(),
                    result: providerResponse
                }
            };
            
            return {
                output: providerResponse,
                state: updatedState
            };
        } catch (error) {
            elizaLogger.error("Error in fetchDtcDatabaseAction:", error);
            return {
                output: "I encountered an error while retrieving diagnostic code information. Please try again with a valid DTC code.",
                state
            };
        }
    }
};

export default fetchDtcDatabaseAction; 