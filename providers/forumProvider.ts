import {
    type Provider,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    stringToUuid,
} from "@elizaos/core";
import { ForumCrawlerService, RepairPost } from '../services/ForumCrawlerService.ts';
import { VehicleInfo } from '../types/vehicle';

const FORUM_DATA_UPDATE_INTERVAL = 3600000; // 1 hour in milliseconds

interface ForumProviderState {
    lastForumUpdate?: number;
    cachedForumPosts?: RepairPost[];
    currentVehicleInfo?: Partial<VehicleInfo>;
    currentDtcCode?: string;
}

export const forumProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Get vehicle info from message metadata
            const vehicleInfo: Partial<VehicleInfo> = {
                make: (message.content?.metadata as { make?: string })?.make || '',
                year: (message.content?.metadata as { year?: string })?.year || '',
            };

            // Get DTC code from message metadata if available
            const dtcCode = (message.content?.metadata as { dtcCode?: string })?.dtcCode || '';

            // Search for forum posts
            const posts = await ForumCrawlerService.searchForumPosts(
                vehicleInfo,
                dtcCode
            );

            return {
                posts,
                vehicleInfo,
                dtcCode,
                timestamp: Date.now()
            };

        } catch (error) {
            elizaLogger.error("Error in forumProvider:", error);
            return null;
        }
    }
};