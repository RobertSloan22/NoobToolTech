import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    stringToUuid,
} from "@elizaos/core";
import { VehicleStats, VehicleDataEntry } from "../actions/vehicleData.ts";

interface TelemetryQuery {
    keywords: string[];
    dataPoints: (stats: VehicleStats, data: VehicleDataEntry[]) => string[];
}

const TELEMETRY_QUERIES: Record<string, TelemetryQuery> = {
    rpm: {
        keywords: ['rpm', 'revs', 'engine speed'],
        dataPoints: (stats, data) => {
            const lastEntry = data[data.length - 1];
            const currentRPM = lastEntry[" Engine RPM (RPM)"];
            return [
                `Current RPM: ${currentRPM.toFixed(0)}`,
                `Average RPM: ${stats.averages.rpm.toFixed(0)}`,
                `Engine Load: ${lastEntry[" Calculated load value (%)"].toFixed(1)}%`,
                `Throttle Position: ${lastEntry[" Absolute throttle position (%)"].toFixed(1)}%`
            ];
        }
    },
    speed: {
        keywords: ['speed', 'velocity', 'mph'],
        dataPoints: (stats, data) => {
            const lastEntry = data[data.length - 1];
            return [
                `Current Speed: ${lastEntry[" Vehicle speed (MPH)"].toFixed(1)} MPH`,
                `Average Speed: ${stats.averages.vehicleSpeed.toFixed(1)} MPH`,
                `Engine Run Time: ${lastEntry[" Time since engine start (sec)"].toFixed(0)} seconds`
            ];
        }
    },
    fuel: {
        keywords: ['fuel', 'mpg', 'economy', 'consumption'],
        dataPoints: (stats, data) => {
            const lastEntry = data[data.length - 1];
            return [
                `Current MPG: ${lastEntry[" Instant fuel economy (MPG)"].toFixed(1)}`,
                `Average MPG: ${stats.averages.totalMPG.toFixed(1)}`,
                `Current Fuel Rate: ${lastEntry[" Fuel rate (gal/hr)"].toFixed(3)} gal/hr`,
                `Average Fuel Rate: ${stats.averages.fuelRate.toFixed(3)} gal/hr`
            ];
        }
    },
    temperature: {
        keywords: ['temp', 'temperature', 'coolant', 'oil'],
        dataPoints: (stats, data) => {
            const lastEntry = data[data.length - 1];
            return [
                `Current Coolant Temp: ${lastEntry[" Engine coolant temperature (°F)"].toFixed(1)}°F`,
                `Current Oil Temp: ${lastEntry[" Engine oil temperature (°F)"].toFixed(1)}°F`,
                `Ambient Temp: ${lastEntry[" Ambient air temperature (°F)"].toFixed(1)}°F`
            ];
        }
    }
};

export const vehicleEvaluator: Evaluator = {
    alwaysRun: false,
    description: "Evaluates vehicle telemetry data queries and handles scheduled updates",
    similes: ["vehicle telemetry monitor", "car data analyzer"],
    examples: [
        {
            context: "Handling vehicle data update trigger",
            messages: [
                {
                    user: "system",
                    content: {
                        text: "fetch vehicle data",
                        metadata: { type: "scheduled-update" }
                    }
                }
            ],
            outcome: "Trigger vehicle data fetch action",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<any> => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            const metadata = memory.content?.metadata as { type?: string } || {};
            const currentVehicleStats = state?.['currentVehicleStats'] as VehicleStats;
            const rawData = state?.['vehicleRawData'] as VehicleDataEntry[];

            // Only fetch vehicle data when explicitly requested for data analysis
            // (not for every message that happens to mention vehicle/engine)
            if ((text.includes("fetch") || text.includes("get") || text.includes("analyze") || text.includes("show")) && 
                (text.includes("vehicle data") || text.includes("car data") || text.includes("diagnostic"))) {
                
                return {
                    score: 1,
                    reason: "Explicitly requested vehicle data for analysis",
                    action: "FETCH_VEHICLE_DATA"
                };
            }

            // High priority for scheduled updates
            if (text.includes("fetch vehicle data") && metadata.type === "scheduled-update") {
                return {
                    score: 1,
                    reason: "Scheduled vehicle data update trigger",
                    action: "FETCH_VEHICLE_DATA"
                };
            }

            // Handle specific telemetry queries if we have data
            if (currentVehicleStats && rawData?.length > 0) {
                // Check for specific telemetry queries
                for (const [category, query] of Object.entries(TELEMETRY_QUERIES)) {
                    if (query.keywords.some(k => text.includes(k))) {
                        const dataPoints = query.dataPoints(currentVehicleStats, rawData);
                        return {
                            score: 0.9,
                            reason: `Vehicle ${category} query`,
                            data: dataPoints
                        };
                    }
                }

                // General vehicle status query
                if (text.includes("status") || text.includes("vehicle") || text.includes("data")) {
                    const lastEntry = rawData[rawData.length - 1];
                    return {
                        score: 0.7,
                        reason: "General vehicle status query",
                        data: [
                            `Engine RPM: ${lastEntry[" Engine RPM (RPM)"].toFixed(0)} RPM`,
                            `Vehicle Speed: ${lastEntry[" Vehicle speed (MPH)"].toFixed(1)} MPH`,
                            `Coolant Temp: ${lastEntry[" Engine coolant temperature (°F)"].toFixed(1)}°F`,
                            `Fuel Rate: ${lastEntry[" Fuel rate (gal/hr)"].toFixed(3)} gal/hr`,
                            `Engine Load: ${lastEntry[" Calculated load value (%)"].toFixed(1)}%`
                        ]
                    };
                }
            }

            return {
                score: 0,
                reason: "Not a vehicle-related query",
            };
        } catch (error) {
            elizaLogger.error("Error in vehicleEvaluator:", error);
            return {
                score: 0,
                reason: "Error evaluating vehicle query",
            };
        }
    },
    name: "vehicleEvaluator",
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        const text = memory.content?.text?.toLowerCase() || "";
        // More specific validation to prevent triggering on any message containing "vehicle"
        return (text.includes("fetch") && text.includes("vehicle data")) || 
               (text.includes("get") && text.includes("vehicle")) ||
               (text.includes("analyze") && text.includes("vehicle")) ||
               Object.values(TELEMETRY_QUERIES)
                   .some(query => query.keywords.some(k => text.includes(k))) ||
               (memory.content?.metadata as { type?: string })?.type === "scheduled-update";
    },
};