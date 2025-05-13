import {
    type Action,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";
import { ConversationCategory } from "../evaluators/conversationRouterEvaluator";

interface RoutingResult {
    routedTo: string;
    assignedAgent?: string;
    priorityLevel: "high" | "medium" | "low";
    estimatedResponseTime?: string;
    suggestedActions: string[];
    trackingId?: string;
}

/**
 * This action handles routing conversations to appropriate handlers based on
 * the type of inquiry, urgency, and complexity determined by the conversation router evaluator.
 */
export const conversationRouterAction: Action = {
    name: "ROUTE_CONVERSATION",
    description: "Routes conversations to the appropriate handling system or specialist",
    similes: ["conversation router", "message traffic controller", "inquiry dispatcher"],
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "My check engine light came on and the car is making a strange noise." }
            },
            {
                user: "{{user2}}",
                content: { 
                    text: "I'll analyze the diagnostic information for you. Let me retrieve the relevant details.",
                    action: "ROUTE_CONVERSATION"
                }
            }
        ]
    ],
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        // Check for routing data in state
        return state?.lastRoutingEvaluation !== undefined;
    },
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State) => {
        try {
            if (!state) {
                return {
                    output: "I can't process this request without the proper state information.",
                    state: {}
                };
            }
            
            // Get routing data from state (set by the conversationRouterEvaluator)
            const routingData = state.lastRoutingEvaluation || { 
                category: ConversationCategory.GENERAL_INQUIRY,
                urgency: "medium",
                complexity: "medium",
                suggestedActions: []
            };
            
            // Extract routing information
            const { 
                category = ConversationCategory.GENERAL_INQUIRY, 
                urgency = "medium", 
                complexity = "medium",
                suggestedActions = []
            } = routingData;
            
            const explicitRouting = (routingData as any).explicitRouting || null;

            // Generate a tracking ID for this conversation
            const trackingId = generateTrackingId();
            
            // Initialize result
            const routingResult: RoutingResult = {
                routedTo: "general_assistant",
                priorityLevel: urgency as "high" | "medium" | "low",
                suggestedActions: [...suggestedActions],
                trackingId
            };

            // Handle explicit routing requests first
            if (explicitRouting) {
                routingResult.routedTo = explicitRouting;
                routingResult.assignedAgent = getSpecialistForRoute(explicitRouting);
                
                // High urgency for explicit routing requests
                routingResult.priorityLevel = "high";
                
                return {
                    output: formatRoutingResponse(routingResult),
                    state: {
                        ...state,
                        conversationRouting: routingResult,
                        lastRoutingTimestamp: new Date().toISOString()
                    }
                };
            }

            // Route based on category and other factors
            switch (category) {
                case ConversationCategory.VEHICLE_DIAGNOSTICS:
                    routingResult.routedTo = "diagnostic_system";
                    // For complex or high urgency diagnostic issues, assign to a specialist
                    if (complexity === "high" || urgency === "high") {
                        routingResult.assignedAgent = "diagnostic_specialist";
                        routingResult.estimatedResponseTime = urgency === "high" ? "5-10 minutes" : "30-60 minutes";
                    }
                    break;
                    
                case ConversationCategory.PARTS_INFORMATION:
                    routingResult.routedTo = "parts_database";
                    if (urgency === "high") {
                        // Add multiple suppliers check for urgent parts inquiries
                        routingResult.suggestedActions.push("CHECK_ALTERNATIVE_SUPPLIERS");
                    }
                    break;
                    
                case ConversationCategory.WARRANTY_SERVICE:
                    routingResult.routedTo = "customer_service";
                    if (urgency === "high") {
                        routingResult.assignedAgent = "customer_service_manager";
                        routingResult.estimatedResponseTime = "15-30 minutes";
                    }
                    break;
                    
                case ConversationCategory.REPAIR_GUIDANCE:
                    routingResult.routedTo = "repair_documentation";
                    if (complexity === "high") {
                        routingResult.suggestedActions.push("RETRIEVE_TECHNICAL_DIAGRAMS");
                        routingResult.assignedAgent = "technical_advisor";
                    }
                    break;
                    
                case ConversationCategory.MAINTENANCE_ADVICE:
                    routingResult.routedTo = "technical_knowledge_base";
                    if (complexity === "high") {
                        routingResult.assignedAgent = "technical_specialist";
                        routingResult.estimatedResponseTime = "1-4 hours";
                    }
                    break;
                    
                default:
                    // General inquiries handled by the default assistant
                    routingResult.routedTo = "general_assistant";
            }

            // Store routing result in state
            const updatedState = {
                ...state,
                conversationRouting: routingResult,
                lastRoutingTimestamp: new Date().toISOString(),
                activeConversationThreads: [
                    ...((state.activeConversationThreads as any[]) || []),
                    {
                        id: trackingId,
                        category,
                        urgency,
                        startTime: new Date().toISOString(),
                        assignedTo: routingResult.assignedAgent || routingResult.routedTo
                    }
                ]
            };

            // Format appropriate response
            return {
                output: formatRoutingResponse(routingResult),
                state: updatedState
            };
        } catch (error) {
            elizaLogger.error("Error in conversationRouterAction:", error);
            return {
                output: "I'm having trouble processing your request. Could you please try again?",
                state: state || {}
            };
        }
    }
};

// Helper function to generate a tracking ID
function generateTrackingId(): string {
    const timestamp = Date.now().toString(36);
    const randomChars = Math.random().toString(36).substring(2, 7);
    return `INQ-${timestamp}-${randomChars}`.toUpperCase();
}

// Helper function to determine appropriate specialist for a route
function getSpecialistForRoute(route: string): string {
    const specialistMap: Record<string, string> = {
        "technician": "senior_technician",
        "customer_service": "customer_service_rep",
        "parts_department": "parts_specialist",
        "service_advisor": "service_manager"
    };
    
    return specialistMap[route] || "general_assistant";
}

// Helper function to format routing response message
function formatRoutingResponse(result: RoutingResult): string {
    // For production, you might want different messaging, but this shows what's happening
    // behind the scenes for development purposes
    
    let response = "";
    
    // Different response types based on where it's routed
    switch (result.routedTo) {
        case "diagnostic_system":
            if (result.assignedAgent) {
                response = `I'm connecting you with our diagnostic specialist who can help troubleshoot this issue.`;
                if (result.estimatedResponseTime) {
                    response += ` They should respond within ${result.estimatedResponseTime}.`;
                }
            } else {
                response = `I'll analyze the diagnostic information for you. Let me retrieve the relevant details.`;
            }
            break;
            
        case "parts_database":
            response = `I'll check our parts inventory system for availability and pricing.`;
            break;
            
        case "customer_service":
            if (result.assignedAgent?.includes("manager")) {
                response = `I'm escalating this to our customer service manager who will assist you`;
                if (result.estimatedResponseTime) {
                    response += ` within ${result.estimatedResponseTime}`;
                }
                response += `.`;
            } else {
                response = `I'll help you with your customer service needs right away.`;
            }
            break;
            
        case "repair_documentation":
            response = `I'm searching our repair documentation database for the information you need.`;
            if (result.assignedAgent) {
                response += ` I'll also connect you with a technical advisor for additional guidance.`;
            }
            break;
            
        case "technical_knowledge_base":
            response = `I'm retrieving technical information to answer your question.`;
            if (result.assignedAgent) {
                response += ` For this complex inquiry, I'll also have our technical specialist review and provide additional insights`;
                if (result.estimatedResponseTime) {
                    response += ` within ${result.estimatedResponseTime}`;
                }
                response += `.`;
            }
            break;
            
        default:
            response = `I'll assist you with your inquiry right away.`;
    }
    
    // Add tracking ID for reference
    if (result.trackingId) {
        response += `\n\nYour inquiry reference number is: ${result.trackingId}`;
    }
    
    return response;
}

export default conversationRouterAction; 