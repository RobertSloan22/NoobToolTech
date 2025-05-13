import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";

// Define categories for different types of conversations
export enum ConversationCategory {
    GENERAL_INQUIRY = "GENERAL_INQUIRY",
    VEHICLE_DIAGNOSTICS = "VEHICLE_DIAGNOSTICS",
    MAINTENANCE_ADVICE = "MAINTENANCE_ADVICE",
    REPAIR_GUIDANCE = "REPAIR_GUIDANCE",
    PARTS_INFORMATION = "PARTS_INFORMATION",
    WARRANTY_SERVICE = "WARRANTY_SERVICE",
    PRICING_INFORMATION = "PRICING_INFORMATION",
    OTHER = "OTHER"
}

// Define indicators for each category
const CATEGORY_INDICATORS = {
    [ConversationCategory.VEHICLE_DIAGNOSTICS]: [
        "check engine light", "check light", "engine light", "code", "dtc",
        "diagnostic", "scanner", "scan tool", "trouble code", "obd", "symptoms",
        "warning light", "cel", "malfunction indicator", "misfire", "stalling"
    ],
    [ConversationCategory.PARTS_INFORMATION]: [
        "part", "parts", "replacement", "price", "pricing", "cost", "buy", 
        "purchase", "available", "in stock", "order", "aftermarket", "oem",
        "brand", "manufacturer", "warranty", "catalog", "alternative"
    ],
    [ConversationCategory.WARRANTY_SERVICE]: [
        "customer", "account", "service history", "last visit", "appointment",
        "schedule", "warranty claim", "invoice", "receipt", "contact", "complaint",
        "satisfaction", "feedback", "loyalty", "discount", "membership"
    ],
    [ConversationCategory.REPAIR_GUIDANCE]: [
        "repair", "procedure", "replace", "install", "installation", "remove",
        "torque spec", "specification", "manual", "guide", "step by step",
        "instruction", "diagram", "schematic", "wiring", "disassemble", "assemble"
    ],
    [ConversationCategory.MAINTENANCE_ADVICE]: [
        "how does", "why does", "what causes", "explain", "understand",
        "technical", "function", "work", "system", "design", "engineering",
        "principle", "theory", "concept", "operation", "mechanism"
    ]
};

// Define urgency indicators
const URGENCY_INDICATORS = {
    HIGH: ["urgent", "emergency", "immediately", "asap", "critical", "safety", "dangerous", "stuck", "stranded"],
    MEDIUM: ["soon", "quickly", "important", "needed", "priority"],
    LOW: ["when possible", "sometime", "no rush", "curious", "interested"]
};

export const conversationRouterEvaluator: Evaluator = {
    alwaysRun: true,
    description: "Evaluates conversation content to determine the appropriate routing and priority",
    similes: ["conversation traffic director", "message router", "inquiry categorizer"],
    examples: [
        {
            context: "Categorizing a diagnostic question",
            messages: [
                {
                    user: "customer",
                    content: {
                        text: "My check engine light came on and the car is making a strange noise when accelerating. What could be wrong?"
                    }
                }
            ],
            outcome: "Categorize as diagnostic inquiry with medium urgency",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<any> => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            const conversationHistory = state?.['conversationHistory'] as Memory[] || [];
            
            // Extract current conversation thread
            const currentThread = [...conversationHistory, memory];
            
            // Determine conversation category
            let highestCategoryScore = 0;
            let category = ConversationCategory.OTHER;
            
            // Calculate score for each category based on keyword matches
            for (const [cat, indicators] of Object.entries(CATEGORY_INDICATORS)) {
                const matchCount = indicators.reduce((count, keyword) => {
                    // Count occurrences across the entire conversation, with more weight on recent messages
                    let score = 0;
                    currentThread.forEach((msg, index) => {
                        const msgText = msg.content?.text?.toLowerCase() || "";
                        if (msgText.includes(keyword)) {
                            // More recent messages get higher weight
                            const recencyWeight = 0.5 + (0.5 * index / Math.max(1, currentThread.length - 1));
                            score += recencyWeight;
                        }
                    });
                    return count + score;
                }, 0);
                
                if (matchCount > highestCategoryScore) {
                    highestCategoryScore = matchCount;
                    category = cat as ConversationCategory;
                }
            }
            
            // Determine urgency level
            let urgency = "medium"; // Default
            
            // Check for high urgency indicators
            if (URGENCY_INDICATORS.HIGH.some(term => text.includes(term))) {
                urgency = "high";
            } 
            // Check for low urgency indicators
            else if (URGENCY_INDICATORS.LOW.some(term => text.includes(term))) {
                urgency = "low";
            }
            
            // Calculate complexity based on message length, technical terms and question types
            const complexity = calculateComplexity(text, currentThread);
            
            // Check for explicit routing requests (e.g., "I need to speak with a technician")
            const explicitRouting = detectExplicitRouting(text);
            
            // Determine appropriate next actions based on categorization
            const suggestedActions = determineSuggestedActions(category, urgency, complexity);
            
            // Set routing score based on confidence
            const routingScore = highestCategoryScore > 0 ? 0.7 : 0.3;
            
            return {
                score: routingScore,
                reason: `Conversation categorized as ${category} with ${urgency} urgency`,
                data: {
                    category,
                    urgency,
                    complexity,
                    explicitRouting,
                    suggestedActions,
                    confidence: routingScore
                }
            };
        } catch (error) {
            elizaLogger.error("Error in conversationRouterEvaluator:", error);
            return {
                score: 0,
                reason: "Error evaluating conversation for routing",
            };
        }
    },
    name: "conversationRouterEvaluator",
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        // Always valid as this evaluator should analyze all messages
        return true;
    },
};

// Helper function to calculate conversation complexity
function calculateComplexity(text: string, thread: Memory[]): "high" | "medium" | "low" {
    // Count technical terms
    const technicalTerms = [
        "diagnostic", "circuit", "sensor", "module", "ecu", "pcm", "tcm", "bcm",
        "voltage", "resistance", "amperage", "pressure", "valve", "actuator",
        "hydraulic", "pneumatic", "electrical", "mechanical", "calibration"
    ];
    
    const technicalCount = technicalTerms.reduce((count, term) => {
        return count + (text.includes(term) ? 1 : 0);
    }, 0);
    
    // Check message length
    const isLongMessage = text.length > 200;
    
    // Check for multiple questions
    const questionCount = (text.match(/\?/g) || []).length;
    
    // Check for complex question types
    const hasComplexQuestions = text.includes("why") || text.includes("how") || 
                              text.includes("explain") || text.includes("compare");
    
    // Calculate overall complexity
    if ((technicalCount >= 3) || (questionCount >= 2 && hasComplexQuestions) || 
        (isLongMessage && technicalCount >= 2)) {
        return "high";
    } else if ((technicalCount >= 1) || hasComplexQuestions || questionCount >= 2) {
        return "medium";
    } else {
        return "low";
    }
}

// Helper function to detect explicit routing requests
function detectExplicitRouting(text: string): string | null {
    const routingRequests = [
        { keywords: ["speak", "talk", "connect", "technician", "mechanic"], route: "technician" },
        { keywords: ["customer service", "support team", "representative"], route: "customer_service" },
        { keywords: ["parts department", "parts specialist"], route: "parts_department" },
        { keywords: ["service advisor", "service manager"], route: "service_advisor" }
    ];
    
    for (const request of routingRequests) {
        if (request.keywords.some(term => text.includes(term))) {
            return request.route;
        }
    }
    
    return null;
}

// Helper function to determine suggested actions
function determineSuggestedActions(category: ConversationCategory, urgency: string, complexity: string): string[] {
    const actions: string[] = [];
    
    switch (category) {
        case ConversationCategory.VEHICLE_DIAGNOSTICS:
            actions.push("FETCH_VEHICLE_DATA");
            actions.push("CHECK_DIAGNOSTIC_CODES");
            if (complexity === "high" || urgency === "high") {
                actions.push("ROUTE_TO_DIAGNOSTIC_SPECIALIST");
            }
            break;
            
        case ConversationCategory.PARTS_INFORMATION:
            actions.push("SEARCH_PARTS_INVENTORY");
            if (urgency === "high") {
                actions.push("CHECK_MULTIPLE_SUPPLIERS");
            }
            break;
            
        case ConversationCategory.WARRANTY_SERVICE:
            actions.push("FETCH_CUSTOMER_DATA");
            if (urgency === "high") {
                actions.push("ESCALATE_TO_MANAGER");
            }
            break;
            
        case ConversationCategory.REPAIR_GUIDANCE:
            actions.push("SEARCH_REPAIR_DOCUMENTATION");
            if (complexity === "high") {
                actions.push("FIND_TECHNICAL_DIAGRAMS");
            }
            break;
            
        case ConversationCategory.MAINTENANCE_ADVICE:
            actions.push("SEARCH_TECHNICAL_DOCUMENTATION");
            if (complexity === "high") {
                actions.push("ROUTE_TO_TECHNICAL_SPECIALIST");
            }
            break;
            
        default:
            actions.push("GENERAL_ASSISTANCE");
    }
    
    return actions;
}

export default conversationRouterEvaluator; 