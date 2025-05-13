import {
    type Evaluator,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";

interface MaintenanceItem {
    service: string;
    mileageInterval: number;
    timeInterval: number; // in months
}

// Define standard maintenance intervals
const MAINTENANCE_SCHEDULE: MaintenanceItem[] = [
    { service: "Oil Change", mileageInterval: 5000, timeInterval: 6 },
    { service: "Tire Rotation", mileageInterval: 7500, timeInterval: 6 },
    { service: "Air Filter", mileageInterval: 15000, timeInterval: 12 },
    { service: "Brake Inspection", mileageInterval: 15000, timeInterval: 12 },
    { service: "Transmission Service", mileageInterval: 30000, timeInterval: 24 },
    { service: "Spark Plugs", mileageInterval: 60000, timeInterval: 36 },
    { service: "Timing Belt", mileageInterval: 60000, timeInterval: 48 },
    { service: "Coolant Flush", mileageInterval: 30000, timeInterval: 24 }
];

interface VehicleMaintenanceHistory {
    vin: string;
    make: string;
    model: string;
    year: number;
    mileage: number;
    maintenanceHistory: {
        date: Date;
        service: string;
        mileage: number;
        description: string;
    }[];
}

export const maintenanceEvaluator: Evaluator = {
    alwaysRun: false,
    description: "Evaluates vehicle maintenance history and suggests upcoming maintenance",
    similes: ["maintenance advisor", "service schedule analyzer"],
    examples: [
        {
            context: "Analyzing maintenance history",
            messages: [
                {
                    user: "user1",
                    content: {
                        text: "What maintenance is due for this vehicle?",
                        metadata: { type: "maintenance-query" }
                    }
                }
            ],
            outcome: "Provide maintenance recommendations based on history",
        }
    ],
    handler: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<any> => {
        try {
            const text = memory.content?.text?.toLowerCase() || "";
            const vehicleData = state?.['currentVehicle'] as VehicleMaintenanceHistory;

            if (!vehicleData) {
                return {
                    score: 0,
                    reason: "No vehicle data available",
                };
            }

            // Check if this is a maintenance-related query
            if (text.includes("maintenance") || text.includes("service") || 
                text.includes("repair") || text.includes("due")) {

                const recommendations = getDueMaintenanceItems(vehicleData);
                
                if (recommendations.length === 0) {
                    return {
                        score: 0.8,
                        reason: "Maintenance analysis - no items due",
                        data: ["No maintenance items are currently due."]
                    };
                }

                return {
                    score: 0.9,
                    reason: "Maintenance analysis completed",
                    data: [
                        `Vehicle: ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}`,
                        `Current Mileage: ${vehicleData.mileage}`,
                        "Recommended Maintenance:",
                        ...recommendations
                    ]
                };
            }

            return {
                score: 0,
                reason: "Not a maintenance-related query",
            };
        } catch (error) {
            elizaLogger.error("Error in maintenanceEvaluator:", error);
            return {
                score: 0,
                reason: "Error evaluating maintenance query",
            };
        }
    },
    name: "maintenanceEvaluator",
    validate: async (runtime: IAgentRuntime, memory: Memory, state?: State): Promise<boolean> => {
        const text = memory.content?.text?.toLowerCase() || "";
        return text.includes("maintenance") || 
               text.includes("service") ||
               text.includes("repair") ||
               text.includes("due") ||
               (memory.content?.metadata as { type?: string })?.type === "maintenance-query";
    },
};

function getDueMaintenanceItems(vehicleData: VehicleMaintenanceHistory): string[] {
    const recommendations: string[] = [];
    const currentDate = new Date();

    for (const item of MAINTENANCE_SCHEDULE) {
        // Find the last time this service was performed
        const lastService = vehicleData.maintenanceHistory
            .filter(h => h.service.toLowerCase().includes(item.service.toLowerCase()))
            .sort((a, b) => b.mileage - a.mileage)[0];

        if (!lastService) {
            recommendations.push(`${item.service} - No record found, inspection recommended`);
            continue;
        }

        const mileageSinceService = vehicleData.mileage - lastService.mileage;
        const monthsSinceService = Math.floor(
            (currentDate.getTime() - new Date(lastService.date).getTime()) / 
            (1000 * 60 * 60 * 24 * 30)
        );

        if (mileageSinceService >= item.mileageInterval || 
            monthsSinceService >= item.timeInterval) {
            recommendations.push(
                `${item.service} - Due (Last done: ${lastService.mileage} miles, ` +
                `${new Date(lastService.date).toLocaleDateString()})`
            );
        }
    }

    // Check for any DTCs or warning indicators
    if (vehicleData.maintenanceHistory.some(h => 
        h.description.toLowerCase().includes("dtc") || 
        h.description.toLowerCase().includes("warning"))) {
        recommendations.push("⚠️ Warning indicators or DTCs found in history - Diagnostic scan recommended");
    }

    return recommendations;
} 