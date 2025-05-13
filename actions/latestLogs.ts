import { Action, IAgentRuntime, Memory, State, stringToUuid } from "@elizaos/core";
import axios from "axios";

export interface VehicleDataEntry {
    "_id": string;
    "Time (sec)": number;
    " Absolute load value (%)": number;
    " Alcohol fuel percentage (%)": number;
    " Ambient air temperature (°F)": number;
    " Calculated load value (%)": number;
    " Fuel rate (gal/hr)": number;
    " Vehicle speed (MPH)": number;
    " Time since engine start (sec)": number;
    " Short term fuel trim (Bank 2  Sensor 2) (%)": number;
    " Short term fuel trim (Bank 1  Sensor 1) (%)": number;
    " Engine coolant temperature (°F)": number;
    " Engine RPM (RPM)": number;
    " PID refresh rate (Hz)": number;
    " Adapter voltage (V)": number;
    " CO2 flow (lb/min)": number;
    " Instant fuel economy (MPG)": number;
    " Total fuel economy (MPG)": number;
    " Absolute evap system vapor pressure (inH2O)": number;
    " Absolute throttle position (%)": number;
    " Actual engine - percent torque (%)": number;
    " Alternative Fuel Rail Pressure (inHg)": number;
    " Barometric pressure (inHg)": number;
    " Battery Capacity Calculation Ready": number;
    " Engine fuel rate (gal/hr)": number;
    " Engine Odometer Reading (miles)": number;
    " Engine oil temperature (°F)": number;
    " Engine run time run while MIL is activated (min)": number;
    " EVAP System Purge Pressure Sensor (inH2O)": number;
    " Long term fuel % trim - Bank 1 (%)": number;
    " Long term fuel % trim - Bank 2 (%)": number;
    " Mass air flow rate (lb/min)": number;
}

export interface VehicleStats {
    totalEntries: number;
    entriesWithSpeed: number;
    realtimeStats: {
        time: number;
        absoluteLoad: number;
        alcoholFuel: number;
        ambientTemp: number;
        calculatedLoad: number;
        fuelRate: number;
        vehicleSpeed: number;
        engineStartTime: number;
        stftBank2: number;
        stftBank1: number;
        coolantTemp: number;
        rpm: number;
        pidRefreshRate: number;
        voltage: number;
        co2Flow: number;
        instantMPG: number;
        totalMPG: number;
        evapPressure: number;
        throttlePosition: number;
        engineTorque: number;
        altFuelPressure: number;
        barometricPressure: number;
        engineFuelRate: number;
        odometer: number;
        oilTemp: number;
        milRunTime: number;
        evapPurgePressure: number;
        ltftBank1: number;
        ltftBank2: number;
        massAirFlow: number;
    };
    averages: {
        time: number;
        absoluteLoad: number;
        alcoholFuel: number;
        ambientTemp: number;
        calculatedLoad: number;
        fuelRate: number;
        vehicleSpeed: number;
        engineStartTime: number;
        stftBank2: number;
        stftBank1: number;
        coolantTemp: number;
        rpm: number;
        pidRefreshRate: number;
        voltage: number;
        co2Flow: number;
        instantMPG: number;
        totalMPG: number;
        evapPressure: number;
        throttlePosition: number;
        engineTorque: number;
        altFuelPressure: number;
        barometricPressure: number;
        engineFuelRate: number;
        odometer: number;
        oilTemp: number;
        milRunTime: number;
        evapPurgePressure: number;
        ltftBank1: number;
        ltftBank2: number;
        massAirFlow: number;
    };
}

export const fetchLatestLogsAction: Action = {
    name: "FETCH_LATEST_LOGS",
    similes: ["GET_LATEST_LOGS", "FETCH_DATA", "VEHICLE_STATS"],
    description: "Fetches vehicle data from the external API and processes it for analysis.",

    // Validation ensures this action is only executed when applicable
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        const text = message.content.text?.toLowerCase();
        return text?.includes('telemetry') || 
               text?.includes('vehicle data') ||
               text?.includes('car data') ||
               text?.includes('vehicle stats') ||
               text?.includes('vehicle status') ||
               text?.includes('car status') ||
               text?.includes('engine data') ||
               text?.includes('show me the vehicle') ||
               text?.includes('get vehicle');
    },

    // The core functionality of the action
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const apiEndpoint = "http://localhost:4000/api/latest-log";
            const response = await axios.get(apiEndpoint);
            
            // Extract the data array and columns from the response
            const { data: dataRows, columns } = response.data;

            if (!Array.isArray(dataRows) || !Array.isArray(columns)) {
                throw new Error("Invalid data format received from API");
            }

            // Get the most recent entry (last row)
            const latestEntry = dataRows[dataRows.length - 1];
            
            // Create a map of the latest values using column names
            const latestValues = columns.reduce((acc, col, index) => {
                acc[col] = latestEntry[index];
                return acc;
            }, {});

            // Format the response text
            const responseText = `I've analyzed the latest vehicle telemetry data. Here's what I found:\n\n` +
                          `🚗 Vehicle Status:\n` +
                          `• Speed: ${latestValues[" Vehicle speed (MPH)"].toFixed(1)} MPH\n` +
                          `• Ambient Temperature: ${latestValues[" Ambient air temperature (°F)"].toFixed(1)}°F\n` +
                          `• Engine Runtime: ${latestValues[" Time since engine start (sec)"].toFixed(0)} seconds\n\n` +
                          `🔧 Engine Parameters:\n` +
                          `• Short Term Fuel Trim:\n` +
                          `  - Bank 1: ${latestValues[" Short term fuel trim (Bank 1  Sensor 1) (%)"].toFixed(1)}%\n` +
                          `  - Bank 2: ${latestValues[" Short term fuel trim (Bank 2  Sensor 2) (%)"].toFixed(1)}%\n` +
                          `• Long Term Fuel Trim:\n` +
                          `  - Bank 1: ${latestValues[" Long term fuel % trim - Bank 1 (%)"].toFixed(1)}%\n` +
                          `  - Bank 2: ${latestValues[" Long term fuel % trim - Bank 2 (%)"].toFixed(1)}%\n\n` +
                          `📊 Sensor Readings:\n` +
                          `• O2 Sensors:\n` +
                          `  - Bank 1 Sensor 1: ${latestValues[" O2 voltage (Bank 1  Sensor 1) (V)"].toFixed(3)}V\n` +
                          `  - Bank 1 Sensor 2: ${latestValues[" O2 voltage (Bank 1  Sensor 2) (V)"].toFixed(3)}V\n` +
                          `  - Bank 2 Sensor 2: ${latestValues[" O2 voltage (Bank 2  Sensor 2) (V)"].toFixed(3)}V\n\n` +
                          `Would you like me to analyze any specific aspect of these readings in more detail?`;

            // Store the raw data in state for future reference
            if (state) {
                state['vehicleRawData'] = dataRows;
                state['vehicleColumns'] = columns;
            }

            // Send the response to the chat
            await runtime.messageManager.createMemory({
                id: stringToUuid('chat-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: responseText,
                    metadata: {
                        type: 'chat-response',
                        timestamp: Date.now()
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error) {
            console.error("Error in vehicle data handler:", error);
            
            // Send error message to chat
            await runtime.messageManager.createMemory({
                id: stringToUuid('error-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `I apologize, but I encountered an error while fetching the vehicle data: ${(error as Error).message}. Please try again in a moment.`,
                    metadata: {
                        type: 'chat-response',
                        error: true,
                        timestamp: Date.now()
                    }
                },
                createdAt: Date.now()
            });

            return false;
        }
    },

    // Example patterns for triggering the action
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Show me the vehicle telemetry data" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here's the latest vehicle telemetry data...", action: "FETCH_LATEST_LOGS" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "What's the current vehicle status?" },
            },
            {
                user: "{{user2}}",
                content: { text: "Here's the current vehicle status...", action: "FETCH_LATEST_LOGS" },
            },
        ],
    ],
};
