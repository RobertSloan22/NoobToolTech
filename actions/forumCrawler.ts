import { Action, IAgentRuntime, Memory, State, stringToUuid } from "@elizaos/core";
import { ForumCrawlerService } from '../services/ForumCrawlerService.ts';
import { VehicleInfo } from '../types/vehicle';

export const forumCrawlerAction: Action = {
    name: "CRAWL_FORUM",
    similes: ["PROCESS_FORUM", "ANALYZE_FORUM", "SEARCH_FORUM"],
    description: "Crawls and analyzes forum content for vehicle repair information",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return text.includes("crawl forum") || 
               text.includes("search forum") || 
               text.includes("analyze forum") ||
               text.includes("check forum");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text || '';
            
            // Extract URL using regex
            const urlMatch = text.match(/https?:\/\/[^\s]+/);
            if (!urlMatch) {
                throw new Error("No valid forum URL found in message");
            }
            const forumUrl = urlMatch[0];

            // Extract potential question from the message
            const question = text.replace(forumUrl, '').trim();

            // Process the forum
            const result = await ForumCrawlerService.processForum(forumUrl, question);

            const summaryText = `Forum processed: ${result.pagesProcessed} pages, ${result.totalChunks} chunks analyzed`;

            // Create embedding for the response
            const embedding = await runtime.messageManager.addEmbeddingToMemory({
                id: stringToUuid('forum-crawler-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: summaryText,
                    metadata: {
                        type: 'forum-analysis',
                        url: forumUrl,
                        pagesProcessed: result.pagesProcessed,
                        totalChunks: result.totalChunks
                    }
                },
                createdAt: Date.now()
            });

            // Create response memory
            await runtime.messageManager.createMemory({
                id: stringToUuid('forum-crawler-result'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embedding?.embedding,
                content: {
                    text: `Forum Analysis Results:\n\n` +
                          `URL: ${forumUrl}\n` +
                          `Pages Processed: ${result.pagesProcessed}\n` +
                          `Total Chunks: ${result.totalChunks}\n` +
                          `Status: ${result.success ? 'Success' : 'Failed'}\n` +
                          `Message: ${result.message}`,
                    metadata: {
                        type: 'forum-analysis',
                        success: result.success,
                        url: forumUrl
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error) {
            console.error("Error processing forum:", error);
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Failed to process forum: ${(error as Error).message}`,
                    metadata: {
                        error: (error as Error).message,
                        type: 'forum_error'
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
                content: { text: "Crawl forum https://example-forum.com/bmw and analyze repair posts" },
            },
            {
                user: "{{user2}}",
                content: { text: "Forum analysis completed", action: "CRAWL_FORUM" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Search forum https://example-forum.com/repairs for BMW N54 timing chain issues" },
            },
            {
                user: "{{user2}}",
                content: { text: "Forum search results ready", action: "CRAWL_FORUM" },
            },
        ],
    ],
};

export const searchForumPostsAction: Action = {
    name: "SEARCH_FORUM_POSTS",
    similes: ["FIND_REPAIR_POSTS", "GET_FORUM_POSTS"],
    description: "Searches forum posts for specific vehicle repairs or DTC codes",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return text.includes("search forum posts") || 
               text.includes("find repair posts") || 
               text.includes("get forum posts");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text || '';
            
            // Extract vehicle info and DTC code from message
            const makeMatch = text.match(/make:\s*([^\s,]+)/i);
            const yearMatch = text.match(/year:\s*(\d{4})/i);
            const dtcMatch = text.match(/dtc:\s*([A-Z0-9]+)/i);

            const vehicleInfo: Partial<VehicleInfo> = {
                make: makeMatch?.[1] || undefined,
                year: yearMatch?.[1] || undefined
            };

            const dtcCode = dtcMatch?.[1];

            // Search forum posts
            const posts = await ForumCrawlerService.searchForumPosts(vehicleInfo, dtcCode);

            const summaryText = `Found ${posts.length} relevant forum posts`;

            // Create embedding for the response
            const embedding = await runtime.messageManager.addEmbeddingToMemory({
                id: stringToUuid('forum-search-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: summaryText,
                    metadata: {
                        type: 'forum-search',
                        postsFound: posts.length
                    }
                },
                createdAt: Date.now()
            });

            // Create response memory
            await runtime.messageManager.createMemory({
                id: stringToUuid('forum-search-result'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embedding?.embedding,
                content: {
                    text: `Forum Search Results:\n\n` +
                          posts.map(post => 
                            `Title: ${post.title}\n` +
                            `URL: ${post.url}\n` +
                            `Vehicle: ${post.vehicleInfo.year} ${post.vehicleInfo.make}\n` +
                            `DTC Codes: ${post.dtcCodes.join(', ')}\n` +
                            `---\n`
                          ).join('\n'),
                    metadata: {
                        type: 'forum-search',
                        postsFound: posts.length
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error) {
            console.error("Error searching forum posts:", error);
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Failed to search forum posts: ${(error as Error).message}`,
                    metadata: {
                        error: (error as Error).message,
                        type: 'forum_search_error'
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
                content: { text: "Search forum posts make: BMW year: 2010 dtc: P0171" },
            },
            {
                user: "{{user2}}",
                content: { text: "Found relevant forum posts", action: "SEARCH_FORUM_POSTS" },
            },
        ],
    ],
};

export default {
    forumCrawlerAction,
    searchForumPostsAction
};