import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";
import { ForumCrawlerService } from '../services/ForumCrawlerService.ts';
const FORUM_KEYWORDS = [
    'forum', 'forums', 'thread', 'post', 'discussion',
    'hyundai-forums', 'bmwforums'
];

interface ForumCrawlerAction {
    type: 'SEARCH_FORUM' | 'QUERY_FORUM' | 'PROCESS_FORUM';
    payload: {
        url?: string;
        question?: string;
        vehicleInfo?: {
            make?: string;
            year?: string;
        };
    };
}

export const forumEvaluator: Evaluator = {
    alwaysRun: false,
    name: "forumEvaluator",
    description: "Evaluates forum-related queries and extracts relevant repair information",
    similes: ["forum knowledge extractor", "repair discussion analyzer"],
    examples: [
        {
            context: "Processing forum search request",
            messages: [
                {
                    user: "user",
                    content: { 
                        text: "Can you check the BMW forums for P0300 misfire issues?" 
                    }
                }
            ],
            outcome: "Extract repair information from forum posts about P0300",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<any> => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            const dtcMatch = text.match(/[PB]\d{4}/i);
            const dtcCode = dtcMatch ? dtcMatch[0] : undefined;

            if (FORUM_KEYWORDS.some(k => text.includes(k))) {
                const result = await ForumCrawlerService.searchForumPosts(
                    state?.currentVehicle ? { 
                        make: typeof state.currentVehicle.make === 'string' ? state.currentVehicle.make : '',
                        model: typeof state.currentVehicle.model === 'string' ? state.currentVehicle.model : '',
                        year: typeof state.currentVehicle.year === 'string' ? state.currentVehicle.year : ''
                    } : {},
                    dtcCode,
                    [text]
                );

                // Save the result to memory
                await runtime.messageManager.createMemory({
                    userId: memory.userId,
                    agentId: memory.agentId,
                    roomId: memory.roomId,
                    content: { text: JSON.stringify(result) }
                });

                return {
                    score: 0.9,
                    reason: "Forum search request detected",
                    action: "SEARCH_FORUM",
                    data: {
                        query: text,
                        dtcCode,
                        vehicleInfo: state?.currentVehicle ? { 
                            make: typeof state.currentVehicle.make === 'string' ? state.currentVehicle.make : '',
                            model: typeof state.currentVehicle.model === 'string' ? state.currentVehicle.model : '',
                            year: typeof state.currentVehicle.year === 'string' ? state.currentVehicle.year : ''
                        } : {}
                    }
                };
            }

            return {
                score: 0,
                reason: "Not a forum-related query"
            };
        } catch (error) {
            elizaLogger.error("Error in forumEvaluator:", error);
            return {
                score: 0,
                reason: "Error processing forum query"
            };
        }
    },
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        const text = memory.content?.text?.toLowerCase() || "";
        return FORUM_KEYWORDS.some(keyword => text.includes(keyword));
    }
};

export class ForumEvaluator {
    private static readonly ISSUE_KEYWORDS = [
        'problem',
        'issue',
        'loose',
        'broken',
        'repair',
        'fix',
        'help'
    ];

    public static evaluateMessage(message: string): ForumCrawlerAction | null {
        message = message.toLowerCase();

        // Check if message contains forum-related content
        const hasForum = FORUM_KEYWORDS.some(keyword => message.includes(keyword));
        const hasIssue = this.ISSUE_KEYWORDS.some(keyword => message.includes(keyword));

        if (!hasForum) {
            return null;
        }

        // Extract URL if present
        const urlMatch = message.match(/https?:\/\/[^\s]+/);
        const forumUrl = urlMatch ? urlMatch[0] : undefined;

        // Extract vehicle info if present
        const vehicleInfo = this.extractVehicleInfo(message);

        if (hasIssue && forumUrl) {
            return {
                type: 'SEARCH_FORUM',
                payload: {
                    url: forumUrl,
                    question: message,
                    vehicleInfo
                }
            };
        }

        return {
            type: 'QUERY_FORUM',
            payload: {
                question: message,
                vehicleInfo
            }
        };
    }

    private static extractVehicleInfo(message: string) {
        const makes = ['hyundai', 'bmw', 'toyota', 'honda', 'ford'];
        const years = message.match(/(19|20)\d{2}/);
        
        const make = makes.find(make => message.includes(make));
        
        return {
            make: make || undefined,
            year: years ? years[0] : undefined
        };
    }

    public static async handleForumAction(action: ForumCrawlerAction): Promise<any> {
        try {
            switch (action.type) {
                case 'SEARCH_FORUM':
                    if (!action.payload.url) {
                        throw new Error('URL is required for forum search');
                    }
                    return await ForumCrawlerService.searchForumPosts(
                        action.payload.vehicleInfo || {},
                        undefined,
                        [action.payload.url]
                    );

                case 'PROCESS_FORUM':
                    if (!action.payload.url) {
                        throw new Error('URL is required for forum processing');
                    }
                    return await ForumCrawlerService.processForum(
                        action.payload.url,
                        action.payload.question
                    );

                case 'QUERY_FORUM':
                    if (!action.payload.question) {
                        throw new Error('Question is required for forum query');
                    }
                    return await ForumCrawlerService.queryForum(
                        action.payload.question
                    );

                default:
                    throw new Error('Unsupported forum action type');
            }
        } catch (error) {
            console.error('Error handling forum action:', error);
            throw error;
        }
    }
}
