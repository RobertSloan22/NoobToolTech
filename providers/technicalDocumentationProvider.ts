import { 
    Provider, 
    IAgentRuntime, 
    Memory, 
    State 
} from "@elizaos/core";
import axios from "axios";

interface TechnicalDocument {
    id: string;
    title: string;
    category: string;
    content: string;
    vehicleCompatibility?: string[];
    source?: string;
    relevanceScore?: number;
    diagrams?: string[];
}

interface SearchResult {
    results: TechnicalDocument[];
    totalFound: number;
    recommendedDocument?: TechnicalDocument;
}

interface Vehicle {
    year: number | string;
    make: string;
    model: string;
    engine?: string;
    transmission?: string;
}

// Mock database endpoints - replace with real endpoints in production
const API_ENDPOINTS = {
    SEARCH: "https://api.yourservice.com/technical-documents/search",
    GET_BY_ID: "https://api.yourservice.com/technical-documents",
    GET_RELATED: "https://api.yourservice.com/technical-documents/related",
};

// Categories of technical documentation
const DOC_CATEGORIES = [
    "repair_procedure",
    "diagnostic_procedure",
    "technical_service_bulletin",
    "maintenance_schedule",
    "wiring_diagram",
    "component_location",
    "specifications",
    "torque_specs",
    "fluid_capacities",
    "removal_installation"
];

/**
 * This provider searches and retrieves technical documentation related to vehicle repair,
 * maintenance, and diagnostics. It can be queried with vehicle information, component names,
 * symptoms, or specific document categories.
 */
const technicalDocumentationProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const query = message.content.text;
            const requestParams: Record<string, any> = {};
            
            // Extract vehicle information from state if available
            const vehicle = state?.currentVehicle as Vehicle | undefined;
            if (vehicle) {
                requestParams.year = vehicle.year;
                requestParams.make = vehicle.make;
                requestParams.model = vehicle.model;
                if (vehicle.engine) requestParams.engine = vehicle.engine;
                if (vehicle.transmission) requestParams.transmission = vehicle.transmission;
            }
            
            // Check for search specification in the query
            let searchType = "general";
            
            // Detect document category from query
            for (const category of DOC_CATEGORIES) {
                if (query.toLowerCase().includes(category.replace('_', ' '))) {
                    requestParams.category = category;
                    searchType = "category";
                    break;
                }
            }
            
            // Detect if this is about a specific diagnostic code
            const dtcMatch = query.toUpperCase().match(/[PBCU][0-9]{4}/);
            if (dtcMatch) {
                requestParams.dtcCode = dtcMatch[0];
                searchType = "diagnostic_code";
            }
            
            // Extract component information
            const componentKeywords = [
                "sensor", "pump", "module", "belt", "hose", "filter", "valve",
                "actuator", "relay", "switch", "motor", "compressor", "alternator",
                "starter", "battery", "transmission", "engine", "brake", "suspension"
            ];
            
            for (const component of componentKeywords) {
                if (query.toLowerCase().includes(component)) {
                    requestParams.component = component;
                    searchType = searchType === "general" ? "component" : searchType;
                    break;
                }
            }
            
            // Handle different types of technical documentation requests
            let results: SearchResult;
            
            // For development/testing - use mock data
            if (process.env.NODE_ENV === "development" || !process.env.USE_LIVE_API) {
                // Use mock data based on search type
                results = getMockDocumentation(query, searchType, requestParams);
            } else {
                // In production, use actual API
                try {
                    const response = await axios.get(API_ENDPOINTS.SEARCH, { params: { query, ...requestParams } });
                    results = response.data;
                } catch (apiError) {
                    console.error("API error:", apiError);
                    // Fallback to mock data if API fails
                    results = getMockDocumentation(query, searchType, requestParams);
                }
            }
            
            // Format the response
            if (results.results.length === 0) {
                return "I couldn't find technical documentation matching your query. Could you provide more specific information about the vehicle or issue?";
            }
            
            // If there's a recommended document, prioritize it
            if (results.recommendedDocument) {
                const doc = results.recommendedDocument;
                
                let response = `I found a relevant technical document for you:\n\n`;
                response += `## ${doc.title}\n\n`;
                
                // Format content with appropriate structure
                response += formatDocumentContent(doc.content);
                
                // Add diagrams if available
                if (doc.diagrams && doc.diagrams.length > 0) {
                    response += `\n\n### Related Diagrams:\n`;
                    doc.diagrams.forEach(diagram => {
                        response += `- [View Diagram](${diagram})\n`;
                    });
                }
                
                // Add source information
                if (doc.source) {
                    response += `\n\nSource: ${doc.source}`;
                }
                
                return response;
            }
            
            // Otherwise, provide a summary of available documents
            let response = `I found ${results.totalFound} technical documents that may help:\n\n`;
            results.results.slice(0, 5).forEach((doc, index) => {
                response += `${index + 1}. **${doc.title}** (${doc.category.replace('_', ' ')})\n`;
                
                // Add a brief excerpt
                const excerpt = doc.content.length > 150 ? 
                    doc.content.substring(0, 150) + "..." : 
                    doc.content;
                
                response += `   ${excerpt}\n\n`;
            });
            
            // Add instructions on how to get more details
            response += `\nYou can ask for more details about any of these documents by specifying the title or number.`;
            
            return response;
        } catch (error) {
            console.error("Error in technicalDocumentationProvider:", error);
            return "I encountered an error while searching for technical documentation. Please try again with more specific information.";
        }
    },
};

// Helper function to format document content for better readability
function formatDocumentContent(content: string): string {
    // Replace technical notation with markdown formatting
    let formatted = content
        .replace(/(\d+)\.\s+/g, '\n$1. ') // Format numbered steps
        .replace(/CAUTION:/g, '⚠️ **CAUTION:**')
        .replace(/WARNING:/g, '⛔ **WARNING:**')
        .replace(/NOTE:/g, '📝 **NOTE:**')
        .replace(/IMPORTANT:/g, '‼️ **IMPORTANT:**')
        .replace(/(\d+)-(\d+)\s+(\w+)/g, '$1-$2 **$3**'); // Highlight part numbers
    
    // Add proper spacing
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    return formatted;
}

// Mock data function for development
function getMockDocumentation(query: string, searchType: string, params: Record<string, any>): SearchResult {
    // Sample mock technical documents based on the search type
    const mockDocuments: Record<string, TechnicalDocument[]> = {
        general: [
            {
                id: "gen-001",
                title: "Basic Vehicle Maintenance Guide",
                category: "maintenance_schedule",
                content: "This document provides general guidelines for vehicle maintenance. Regular maintenance includes oil changes every 5,000-7,500 miles, tire rotation every 5,000-8,000 miles, and brake inspection every 10,000 miles.",
                vehicleCompatibility: ["All vehicles"],
                source: "Automotive Service Manual",
                relevanceScore: 0.75
            }
        ],
        diagnostic_code: [
            {
                id: "dtc-001",
                title: `Diagnostic Information for ${params.dtcCode || "P0420"}`,
                category: "diagnostic_procedure",
                content: `Code ${params.dtcCode || "P0420"} indicates a Catalyst System Efficiency Below Threshold. This is typically related to the catalytic converter's performance.\n\n1. CHECK FOR EXHAUST LEAKS\nInspect the exhaust system for leaks from the exhaust manifold to the catalytic converter.\n\n2. CHECK OXYGEN SENSORS\nVerify proper operation of both upstream and downstream oxygen sensors.\n\n3. INSPECT CATALYTIC CONVERTER\nVisually inspect the catalytic converter for damage.\n\nCAUTION: Allow the exhaust system to cool before inspection to avoid burns.\n\n4. SCAN LIVE DATA\nObserve the oxygen sensor data streams to confirm slow response from the downstream O2 sensor.`,
                vehicleCompatibility: ["Multiple vehicles"],
                source: "OEM Service Information",
                relevanceScore: 0.95,
                diagrams: ["https://example.com/diagrams/catalyst-system.png"]
            }
        ],
        component: [
            {
                id: "comp-001",
                title: `${params.component || "Sensor"} Replacement Procedure`,
                category: "removal_installation",
                content: `This procedure covers the removal and installation of the ${params.component || "sensor"}.\n\n1. DISCONNECT THE BATTERY\nDisconnect the negative battery terminal.\n\n2. LOCATE THE COMPONENT\nThe ${params.component || "sensor"} is located on the [specific location based on vehicle].\n\nNOTE: Reference the appropriate diagram for your specific vehicle model.\n\n3. DISCONNECT ELECTRICAL CONNECTIONS\nCarefully disconnect the electrical connector by pressing the release tab and pulling straight out.\n\n4. REMOVE THE COMPONENT\nUse the appropriate socket or wrench to remove the ${params.component || "sensor"}. Torque specification: XX Nm (XX ft-lb).\n\n5. INSTALLATION\nInstallation is the reverse of removal. Apply appropriate anti-seize compound to threads if specified.`,
                vehicleCompatibility: ["Multiple vehicles"],
                source: "Technical Service Manual",
                relevanceScore: 0.85,
                diagrams: ["https://example.com/diagrams/component-location.png"]
            }
        ],
        category: [
            {
                id: "cat-001",
                title: `${params.category?.replace('_', ' ') || "Repair Procedure"} Guide`,
                category: params.category || "repair_procedure",
                content: `This document provides comprehensive information about ${params.category?.replace('_', ' ') || "repair procedures"}.\n\nThe document includes manufacturer-specified steps, tools required, and safety precautions for proper service procedure.`,
                vehicleCompatibility: ["Multiple vehicles"],
                source: "Service Information Database",
                relevanceScore: 0.8
            }
        ]
    };
    
    // Return appropriate mock data based on search type
    const results = mockDocuments[searchType] || mockDocuments.general;
    
    // For diagnostic codes, always return the recommended document
    return {
        results,
        totalFound: results.length,
        recommendedDocument: searchType === "diagnostic_code" ? results[0] : undefined
    };
}

export default technicalDocumentationProvider; 