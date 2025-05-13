import {
    type Provider,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    stringToUuid,
} from "@elizaos/core";
import { VehicleStats } from "../actions/vehicleData.ts";

const VEHICLE_DATA_UPDATE_INTERVAL = 60000; // 1 minute in milliseconds

export const vehicleProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const currentTime = Date.now();
            const lastUpdate = (state?.['lastVehicleDataUpdate'] as number) || 0;

            // Check if we need to update vehicle data
            if (currentTime - lastUpdate >= VEHICLE_DATA_UPDATE_INTERVAL) {
                // First get embedding for the memory
                const triggerMemory = {
                    id: stringToUuid('fetch-vehicle-trigger'),
                    userId: message.userId,
                    roomId: message.roomId,
                    agentId: runtime.agentId,
                    content: {
                        text: "fetch vehicle data",
                        metadata: {
                            type: 'scheduled-update',
                            timestamp: currentTime
                        }
                    },
                    createdAt: currentTime
                };

                // Add embedding to the memory before creating it
                const memoryWithEmbedding = await runtime.messageManager.addEmbeddingToMemory(triggerMemory);
                await runtime.messageManager.createMemory(memoryWithEmbedding);

                // Update the last update timestamp
                if (state) {
                    state['lastVehicleDataUpdate'] = currentTime;
                }
            }

            // Try to get cached vehicle stats first
            let vehicleStats = state?.['currentVehicleStats'] as VehicleStats | undefined;

            // If no cached stats or they're too old, get from knowledge manager
            if (!vehicleStats || (currentTime - lastUpdate >= VEHICLE_DATA_UPDATE_INTERVAL)) {
                const recentAnalysis = await runtime.knowledgeManager.getMemories({
                    roomId: message.roomId,
                    count: 1,
                    unique: true
                });

                const vehicleAnalysis = recentAnalysis.find(m => 
                    (m.content?.metadata as { type?: string })?.type === 'vehicle-analysis'
                );
                
                if (vehicleAnalysis) {
                    vehicleStats = JSON.parse(vehicleAnalysis.content.text);
                    if (state) {
                        state['currentVehicleStats'] = vehicleStats;
                    }
                }
            }

            if (!vehicleStats) {
                elizaLogger.warn("No vehicle stats available");
                return null;
            }

            // Return the full stats object for the evaluator to process
            return vehicleStats;
        } catch (error) {
            elizaLogger.error("Error in vehicleProvider:", error);
            return null;
        }
    },
};