import { 
    Provider, 
    IAgentRuntime, 
    Memory, 
    State 
} from "@elizaos/core";
import axios from "axios";

interface DTCRecord {
    code: string;
    description: string;
    possibleCauses: string[];
    symptoms: string[];
    fixes: string[];
    severity: "critical" | "severe" | "moderate" | "informational" | "unknown";
    system: string;
    vehicleSpecific?: boolean;
}

interface Vehicle {
    year: number | string;
    make: string;
    model: string;
    engine?: string;
    transmission?: string;
}

// Mock database endpoint - replace with real endpoint in production
const API_ENDPOINT = "https://api.yourservice.com/dtc-database";

/**
 * This provider retrieves diagnostic trouble code information including
 * descriptions, possible causes, symptoms, and recommended fixes.
 */
const dtcDatabaseProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Extract the DTC code from the message
            const query = message.content.text;
            const dtcMatch = query.toUpperCase().match(/[PBCU][0-9]{4}/);
            
            if (!dtcMatch) {
                return "Please provide a valid diagnostic trouble code (DTC) in the format P0123, B0123, C0123, or U0123.";
            }
            
            const dtcCode = dtcMatch[0];
            let dtcData: DTCRecord | null = null;
            
            // Get vehicle information from state if available
            const vehicle = state?.currentVehicle as Vehicle | undefined;
            
            // For development/testing - use mock data
            if (process.env.NODE_ENV === "development" || !process.env.USE_LIVE_API) {
                // Use mock data
                dtcData = getMockDTCData(dtcCode, vehicle);
            } else {
                // In production, fetch from the actual API
                try {
                    const params: Record<string, any> = { code: dtcCode };
                    if (vehicle) {
                        params.year = vehicle.year;
                        params.make = vehicle.make;
                        params.model = vehicle.model;
                    }
                    
                    const response = await axios.get(API_ENDPOINT, { params });
                    dtcData = response.data;
                } catch (apiError) {
                    console.error("API error:", apiError);
                    // Fallback to mock data if API fails
                    dtcData = getMockDTCData(dtcCode, vehicle);
                }
            }
            
            if (!dtcData) {
                return `I couldn't find information for the diagnostic code ${dtcCode}. This may be a manufacturer-specific code.`;
            }
            
            // Format the response
            return formatDTCResponse(dtcData, vehicle);
        } catch (error) {
            console.error("Error in dtcDatabaseProvider:", error);
            return "I encountered an error while retrieving the diagnostic code information. Please try again with a valid DTC code.";
        }
    },
};

// Helper function to format the DTC response
function formatDTCResponse(dtc: DTCRecord, vehicle?: Vehicle): string {
    // Add vehicle-specific note if applicable
    const vehicleNote = vehicle && dtc.vehicleSpecific
        ? `\n\n**Note:** This information is specific to your ${vehicle.year} ${vehicle.make} ${vehicle.model}.`
        : '';
        
    // Determine severity label and emoji
    let severityLabel;
    switch (dtc.severity) {
        case 'critical':
            severityLabel = '🔴 Critical - Immediate attention required';
            break;
        case 'severe':
            severityLabel = '🟠 Severe - Service soon';
            break;
        case 'moderate':
            severityLabel = '🟡 Moderate - Monitor and service';
            break;
        case 'informational':
            severityLabel = '🔵 Informational - No immediate action required';
            break;
        default:
            severityLabel = '⚪ Unknown severity';
    }
    
    // Format the output
    let response = `## Diagnostic Code: ${dtc.code}\n\n`;
    response += `**System:** ${dtc.system}\n`;
    response += `**Severity:** ${severityLabel}\n\n`;
    response += `**Description:**\n${dtc.description}\n\n`;
    
    if (dtc.symptoms && dtc.symptoms.length > 0) {
        response += "**Common Symptoms:**\n";
        dtc.symptoms.forEach(symptom => {
            response += `- ${symptom}\n`;
        });
        response += "\n";
    }
    
    if (dtc.possibleCauses && dtc.possibleCauses.length > 0) {
        response += "**Possible Causes:**\n";
        dtc.possibleCauses.forEach(cause => {
            response += `- ${cause}\n`;
        });
        response += "\n";
    }
    
    if (dtc.fixes && dtc.fixes.length > 0) {
        response += "**Recommended Fixes:**\n";
        dtc.fixes.forEach(fix => {
            response += `- ${fix}\n`;
        });
    }
    
    response += vehicleNote;
    
    return response;
}

// Mock DTC database for development/testing
function getMockDTCData(code: string, vehicle?: Vehicle): DTCRecord | null {
    // Common DTC codes with mock data
    const dtcDatabase: Record<string, DTCRecord> = {
        "P0420": {
            code: "P0420",
            description: "Catalyst System Efficiency Below Threshold (Bank 1)",
            possibleCauses: [
                "Faulty catalytic converter",
                "Exhaust leaks before or after the catalytic converter",
                "Damaged oxygen (O2) sensors",
                "Engine misfires causing catalytic converter damage",
                "Failed or contaminated oxygen sensors"
            ],
            symptoms: [
                "Check Engine Light on",
                "Failed emissions test",
                "No noticeable performance issues in most cases",
                "Possible slight reduction in fuel efficiency"
            ],
            fixes: [
                "Inspect and repair any exhaust leaks",
                "Check for engine misfire codes and fix underlying issues",
                "Test oxygen sensors and replace if needed",
                "Replace catalytic converter if efficiency is confirmed low"
            ],
            severity: "moderate",
            system: "Emissions Control"
        },
        "P0171": {
            code: "P0171",
            description: "System Too Lean (Bank 1)",
            possibleCauses: [
                "Vacuum leaks in the intake manifold or connected hoses",
                "Faulty or dirty mass airflow sensor (MAF)",
                "Clogged fuel injectors",
                "Fuel pump delivering insufficient pressure",
                "Faulty oxygen sensor",
                "Clogged fuel filter",
                "Exhaust gas recirculation (EGR) valve stuck open"
            ],
            symptoms: [
                "Check Engine Light on",
                "Rough idle",
                "Engine hesitation or stumble during acceleration",
                "Hard starting conditions",
                "Increased fuel consumption"
            ],
            fixes: [
                "Inspect for and repair vacuum leaks",
                "Clean or replace the mass airflow sensor",
                "Check fuel pressure and repair fuel delivery system if needed",
                "Clean or replace fuel injectors if clogged",
                "Replace oxygen sensor if faulty"
            ],
            severity: "moderate",
            system: "Fuel and Air Metering"
        },
        "P0300": {
            code: "P0300",
            description: "Random/Multiple Cylinder Misfire Detected",
            possibleCauses: [
                "Worn spark plugs or ignition coils",
                "Faulty spark plug wires",
                "Vacuum leaks",
                "Low fuel pressure",
                "Faulty fuel injectors",
                "Low compression in multiple cylinders",
                "Camshaft timing issues",
                "EGR valve malfunction"
            ],
            symptoms: [
                "Check Engine Light on or flashing",
                "Engine running rough, especially at idle",
                "Lack of power during acceleration",
                "Increased fuel consumption",
                "Engine hesitation or stumbling",
                "Rough idle or stalling"
            ],
            fixes: [
                "Check and replace spark plugs and ignition coils as needed",
                "Perform compression test to check for mechanical engine issues",
                "Inspect for vacuum leaks and repair as needed",
                "Test fuel pressure and fuel injectors",
                "Check camshaft timing and adjust if necessary"
            ],
            severity: "severe",
            system: "Ignition System"
        },
        "C0035": {
            code: "C0035",
            description: "Left Front Wheel Speed Sensor Circuit Malfunction",
            possibleCauses: [
                "Damaged wheel speed sensor",
                "Wiring issues in wheel speed sensor circuit",
                "Debris on the sensor or tone ring",
                "Damaged tone ring",
                "ABS control module failure"
            ],
            symptoms: [
                "ABS warning light on",
                "Traction control light on",
                "Stability control system disabled",
                "ABS system disabled"
            ],
            fixes: [
                "Inspect wheel speed sensor and wiring for damage",
                "Clean sensor and tone ring of debris",
                "Replace wheel speed sensor if damaged",
                "Repair wiring issues in the circuit",
                "Replace tone ring if damaged"
            ],
            severity: "critical",
            system: "Braking System"
        },
        "B0100": {
            code: "B0100",
            description: "Driver's Airbag Circuit Malfunction",
            possibleCauses: [
                "Damaged airbag clockspring",
                "Wiring issues in airbag circuit",
                "Faulty driver's airbag module",
                "SRS control module failure",
                "Loose airbag connectors"
            ],
            symptoms: [
                "Airbag warning light on",
                "SRS system disabled"
            ],
            fixes: [
                "Scan for additional SRS codes",
                "Inspect clockspring and airbag wiring",
                "Check airbag connections",
                "Replace clockspring if damaged",
                "Replace driver's airbag module if faulty"
            ],
            severity: "critical",
            system: "Restraints"
        },
        "U0100": {
            code: "U0100",
            description: "Lost Communication with ECM/PCM",
            possibleCauses: [
                "CAN bus communication issues",
                "Faulty ECM/PCM module",
                "Power or ground issues to the ECM/PCM",
                "Damaged wiring in the CAN bus network",
                "Water damage to control modules"
            ],
            symptoms: [
                "Multiple warning lights on dash",
                "Engine performance issues",
                "Vehicle may not start",
                "Various systems may not function properly"
            ],
            fixes: [
                "Check power and ground connections to ECM/PCM",
                "Inspect CAN bus wiring for damage",
                "Test battery voltage and charging system",
                "Scan all modules for additional codes",
                "Check for water damage to electrical components"
            ],
            severity: "severe",
            system: "Network Communication"
        }
    };
    
    // First see if we have the exact code
    if (dtcDatabase[code]) {
        const result = { ...dtcDatabase[code] };
        
        // Add vehicle-specific flag if vehicle info is present
        if (vehicle) {
            result.vehicleSpecific = false; // In a real system, this would be determined dynamically
        }
        
        return result;
    }
    
    // If not found, try to generate a generic response based on code type
    const codeType = code.charAt(0);
    const codeNumber = code.substring(1);
    
    // Create generic description based on code type
    let genericDescription = "";
    let system = "Unknown";
    let severity: DTCRecord["severity"] = "unknown";
    
    switch (codeType) {
        case "P":
            system = codeNumber.startsWith("0") ? "Powertrain - Generic OBD-II" : "Powertrain - Manufacturer Specific";
            severity = "moderate";
            genericDescription = `Generic powertrain issue. This code is related to the engine, transmission, or emissions systems.`;
            break;
        case "B":
            system = codeNumber.startsWith("0") ? "Body - Generic OBD-II" : "Body - Manufacturer Specific";
            severity = codeNumber.startsWith("0") ? "moderate" : "informational";
            genericDescription = `Body system issue. This code is related to functions typically controlled by the body control module.`;
            break;
        case "C":
            system = codeNumber.startsWith("0") ? "Chassis - Generic OBD-II" : "Chassis - Manufacturer Specific";
            severity = codeNumber.startsWith("0") ? "critical" : "severe";
            genericDescription = `Chassis system issue. This code is related to mechanical systems like braking, steering, or suspension.`;
            break;
        case "U":
            system = codeNumber.startsWith("0") ? "Network - Generic OBD-II" : "Network - Manufacturer Specific";
            severity = "severe";
            genericDescription = `Network communication issue. This code is related to communication between control modules.`;
            break;
        default:
            return null;
    }
    
    // Return generic information when specific code not found
    return {
        code,
        description: genericDescription,
        possibleCauses: ["Unknown - This is a generic interpretation only"],
        symptoms: ["Check Engine Light or other warning lights may be illuminated"],
        fixes: ["Consult a professional diagnostic service for this specific code", 
                "Check technical service bulletins (TSBs) for your specific vehicle"],
        severity,
        system,
        vehicleSpecific: false
    };
}

export default dtcDatabaseProvider; 