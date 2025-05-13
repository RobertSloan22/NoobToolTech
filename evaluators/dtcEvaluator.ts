import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";

interface DTCInfo {
    code: string;
    description?: string;
    system?: string;
    severity?: "critical" | "severe" | "moderate" | "informational" | "unknown";
}

// Common DTC code patterns
const DTC_PATTERNS = [
    /P[0-9]{4}/g,   // Powertrain
    /B[0-9]{4}/g,   // Body
    /C[0-9]{4}/g,   // Chassis
    /U[0-9]{4}/g,   // Network
];

// Severity assessment based on code prefix
type SeverityType = "critical" | "severe" | "moderate" | "informational" | "unknown";
const SEVERITY_MAP: Record<string, SeverityType> = {
    "P0": "severe",      // Generic powertrain
    "P1": "moderate",    // Manufacturer-specific powertrain
    "P2": "severe",      // Generic powertrain
    "P3": "moderate",    // Generic/manufacturer shared powertrain
    "B0": "moderate",    // Generic body
    "B1": "informational", // Manufacturer-specific body
    "B2": "moderate",    // Generic body
    "B3": "informational", // Generic/manufacturer shared body
    "C0": "critical",    // Generic chassis - often safety related
    "C1": "severe",      // Manufacturer-specific chassis
    "C2": "critical",    // Generic chassis
    "C3": "severe",      // Generic/manufacturer shared chassis
    "U0": "severe",      // Generic network
    "U1": "moderate",    // Manufacturer-specific network
    "U2": "severe",      // Generic network
    "U3": "moderate",    // Generic/manufacturer shared network
};

// System categorization based on code
const SYSTEM_CATEGORIZATION: Record<string, string> = {
    // Powertrain general systems
    "P00": "Engine Management",
    "P01": "Fuel and Air Metering",
    "P02": "Fuel and Air Metering",
    "P03": "Ignition System",
    "P04": "Auxiliary Emissions Controls",
    "P05": "Vehicle Speed Control and Idle Control",
    "P06": "Computer Output Circuit",
    "P07": "Transmission",
    "P08": "Transmission",
    "P09": "Transmission",
    // Body systems
    "B00": "Body Controls",
    "B01": "Body Controls",
    "B02": "Body Controls",
    "B03": "Body Controls",
    "B04": "Body Controls",
    "B05": "Restraints",
    "B06": "Restraints",
    "B07": "Restraints",
    // Chassis systems
    "C00": "Braking System",
    "C01": "Braking System",
    "C02": "Braking System",
    "C03": "Steering System",
    "C04": "Suspension System",
    "C05": "Steering System",
    "C06": "Suspension System",
    "C07": "Wheels/Tires",
    // Network systems
    "U00": "Network Communication",
    "U01": "Network Communication",
    "U02": "Network Communication",
    "U03": "Network Communication",
    "U04": "Network Communication",
};

export const dtcEvaluator: Evaluator = {
    alwaysRun: false,
    description: "Evaluates messages for diagnostic trouble codes (DTCs) and provides information about them",
    similes: ["automotive code interpreter", "DTC analyzer", "vehicle diagnostic assistant"],
    examples: [
        {
            context: "Identifying DTCs in a message",
            messages: [
                {
                    user: "customer",
                    content: {
                        text: "My car is showing a P0420 code. What does this mean?"
                    }
                }
            ],
            outcome: "Identify P0420 code and provide information about it",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<any> => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            
            // Don't process if there's no text or likely not DTC-related
            if (!text || (!text.includes("code") && !text.includes("dtc") && 
                !DTC_PATTERNS.some(pattern => pattern.test(text)))) {
                return {
                    score: 0,
                    reason: "Not DTC-related content",
                };
            }
            
            // Find all potential DTC codes in the message
            const foundCodes: DTCInfo[] = [];
            const upperText = text.toUpperCase();
            
            for (const pattern of DTC_PATTERNS) {
                const matches = upperText.match(pattern);
                if (matches) {
                    matches.forEach(code => {
                        // Categorize the DTC
                        const prefix = code.substring(0, 2); // e.g., P0, C1
                        const category = code.substring(0, 3); // e.g., P00, C10
                        
                        foundCodes.push({
                            code,
                            system: SYSTEM_CATEGORIZATION[category] || "Unknown System",
                            severity: SEVERITY_MAP[prefix] || "unknown"
                        });
                    });
                }
            }
            
            // If we found codes, prepare the response
            if (foundCodes.length > 0) {
                // Get additional information about the codes from state if available
                const dtcDatabase = state?.['dtcDatabase'] as Record<string, any> || {};
                
                // Enhance each code with additional information if available
                foundCodes.forEach(codeInfo => {
                    if (dtcDatabase[codeInfo.code]) {
                        codeInfo.description = dtcDatabase[codeInfo.code].description;
                    } else {
                        // Generic descriptions based on system if specific code not found
                        codeInfo.description = `${codeInfo.system} related issue. This code requires further diagnosis.`;
                    }
                });
                
                // Determine if we need to fetch more information
                const needMoreInfo = foundCodes.some(code => !code.description || code.description.includes("further diagnosis"));
                
                return {
                    score: 0.9,
                    reason: `Found ${foundCodes.length} diagnostic trouble code(s)`,
                    data: {
                        dtcCodes: foundCodes,
                        needsAdditionalInfo: needMoreInfo,
                        suggestedActions: needMoreInfo ? ["FETCH_DTC_DATABASE", "SEARCH_TECHNICAL_DOCUMENTATION"] : []
                    }
                };
            }
            
            return {
                score: 0,
                reason: "No DTC codes found in message",
            };
        } catch (error) {
            elizaLogger.error("Error in dtcEvaluator:", error);
            return {
                score: 0,
                reason: "Error evaluating for DTCs",
            };
        }
    },
    name: "dtcEvaluator",
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        const text = memory.content?.text?.toLowerCase() || "";
        
        // Check for keywords related to DTCs or pattern matches
        return text.includes("code") || 
               text.includes("dtc") || 
               text.includes("diagnostic trouble") ||
               text.includes("check engine") ||
               DTC_PATTERNS.some(pattern => pattern.test(text.toUpperCase()));
    },
};

export default dtcEvaluator; 