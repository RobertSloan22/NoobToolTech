import { 
    Provider, 
    IAgentRuntime, 
    Memory, 
    State 
} from "@elizaos/core";

interface ConversationThread {
    id: string;
    category: string;
    assignedTo: string;
    startTime: string;
    lastUpdateTime?: string;
    status: "active" | "pending" | "resolved" | "closed";
    urgency: "high" | "medium" | "low";
    summary?: string;
}

/**
 * This provider retrieves information about active conversation threads
 * to allow monitoring and management of multiple simultaneous conversations.
 */
const conversationThreadsProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const query = message.content.text.toLowerCase();
            
            // Get active threads from state, ensure it's properly typed
            const activeThreads: ConversationThread[] = 
                (state?.activeConversationThreads as ConversationThread[]) || [];
            
            // If no threads are active, provide an appropriate response
            if (activeThreads.length === 0) {
                return "There are no active conversation threads at the moment.";
            }
            
            // Determine if a specific thread is being queried
            const threadMatch = query.match(/thread\s+([a-z0-9-]+)/i);
            if (threadMatch && threadMatch[1]) {
                const threadId = threadMatch[1].toUpperCase();
                const thread = activeThreads.find(t => t.id === threadId);
                
                if (thread) {
                    return formatThreadDetails(thread);
                } else {
                    return `Conversation thread with ID ${threadId} not found. Please check the ID and try again.`;
                }
            }
            
            // Check if specific category or status is being queried
            let filteredThreads = [...activeThreads];
            
            if (query.includes("high urgency") || query.includes("urgent")) {
                filteredThreads = filteredThreads.filter(t => t.urgency === "high");
            } else if (query.includes("diagnostic") || query.includes("dtc") || query.includes("code")) {
                filteredThreads = filteredThreads.filter(t => t.category === "diagnostic");
            } else if (query.includes("parts") || query.includes("pricing")) {
                filteredThreads = filteredThreads.filter(t => t.category === "parts_inquiry");
            } else if (query.includes("customer") || query.includes("support")) {
                filteredThreads = filteredThreads.filter(t => t.category === "customer_support");
            } else if (query.includes("repair") || query.includes("procedure")) {
                filteredThreads = filteredThreads.filter(t => t.category === "repair_procedure");
            } else if (query.includes("technical") || query.includes("question")) {
                filteredThreads = filteredThreads.filter(t => t.category === "technical_question");
            }
            
            // If a summary of all threads is requested
            if (query.includes("summary") || query.includes("overview")) {
                return formatThreadsSummary(filteredThreads);
            }
            
            // Default to providing a list of all threads
            return formatThreadsList(filteredThreads);
        } catch (error) {
            console.error("Error in conversationThreadsProvider:", error);
            return "I encountered an error while retrieving conversation threads information. Please try again.";
        }
    },
};

// Helper function to format the details of a single thread
function formatThreadDetails(thread: ConversationThread): string {
    // Calculate duration
    const startTime = new Date(thread.startTime);
    const now = new Date();
    const durationMs = now.getTime() - startTime.getTime();
    const durationMins = Math.floor(durationMs / 60000);
    const durationHours = Math.floor(durationMins / 60);
    
    let durationStr = '';
    if (durationHours > 0) {
        durationStr = `${durationHours} hour${durationHours > 1 ? 's' : ''} ${durationMins % 60} minute${durationMins % 60 > 1 ? 's' : ''}`;
    } else {
        durationStr = `${durationMins} minute${durationMins > 1 ? 's' : ''}`;
    }
    
    // Format the thread details
    let response = `## Conversation Thread: ${thread.id}\n\n`;
    response += `**Category:** ${thread.category.replace('_', ' ')}\n`;
    response += `**Status:** ${thread.status || 'active'}\n`;
    response += `**Urgency:** ${thread.urgency || 'medium'}\n`;
    response += `**Assigned To:** ${thread.assignedTo.replace('_', ' ')}\n`;
    response += `**Started:** ${new Date(thread.startTime).toLocaleString()}\n`;
    response += `**Duration:** ${durationStr}\n`;
    
    if (thread.lastUpdateTime) {
        response += `**Last Updated:** ${new Date(thread.lastUpdateTime).toLocaleString()}\n`;
    }
    
    if (thread.summary) {
        response += `\n**Summary:**\n${thread.summary}\n`;
    }
    
    return response;
}

// Helper function to format a summary of all threads
function formatThreadsSummary(threads: ConversationThread[]): string {
    // Count threads by category
    const categoryCounts: Record<string, number> = {};
    const urgencyCounts = { high: 0, medium: 0, low: 0 };
    
    threads.forEach(thread => {
        // Count by category
        const category = thread.category || 'unknown';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        
        // Count by urgency
        const urgency = thread.urgency || 'medium';
        if (urgency === 'high') urgencyCounts.high++;
        else if (urgency === 'medium') urgencyCounts.medium++;
        else if (urgency === 'low') urgencyCounts.low++;
    });
    
    let response = `## Conversation Threads Summary\n\n`;
    response += `**Total Active Threads:** ${threads.length}\n\n`;
    
    response += `**By Category:**\n`;
    Object.entries(categoryCounts).forEach(([category, count]) => {
        response += `- ${category.replace('_', ' ')}: ${count}\n`;
    });
    
    response += `\n**By Urgency:**\n`;
    response += `- High: ${urgencyCounts.high}\n`;
    response += `- Medium: ${urgencyCounts.medium}\n`;
    response += `- Low: ${urgencyCounts.low}\n`;
    
    return response;
}

// Helper function to format a list of threads
function formatThreadsList(threads: ConversationThread[]): string {
    if (threads.length === 0) {
        return "No conversation threads match your criteria.";
    }
    
    let response = `## Active Conversation Threads\n\n`;
    
    threads.forEach((thread, index) => {
        const urgencyEmoji = 
            thread.urgency === 'high' ? '🔴' : 
            thread.urgency === 'medium' ? '🟡' : 
            thread.urgency === 'low' ? '🟢' : '⚪';
            
        response += `${index + 1}. ${urgencyEmoji} **${thread.id}** - ${thread.category.replace('_', ' ')}\n`;
        response += `   Assigned to: ${thread.assignedTo.replace('_', ' ')}\n`;
        response += `   Started: ${new Date(thread.startTime).toLocaleString()}\n\n`;
    });
    
    response += `\nFor more details on a specific thread, ask about it by ID.`;
    
    return response;
}

export default conversationThreadsProvider; 