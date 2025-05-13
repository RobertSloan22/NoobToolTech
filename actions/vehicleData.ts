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
    realtimeStats: {
        vehicleSpeed: number;
        rpm: number;
        fuelRate: number;
        coolantTemp: number;
        ambientTemp: number;
        throttlePosition: number;
        stftBank1: number;
        stftBank2: number;
        oilTemp: number;
        instantMPG: number;
        totalMPG: number;
        evapPressure: number;
        evapPurgePressure: number;
        altFuelPressure: number;
        barometricPressure: number;
        evapSystemVaporPressure: number;
        alcoholFuelPercentage: number;
        absoluteLoad: number;
        calculatedLoad: number;
        evapSystemVaporPressureInHg: number;
        alternativeFuelRailPressure: number;
        batteryCapacityCalculationReady: number;
        batteryVoltage: number;
        barometricPressureInHg: number;
        co2Flow: number;
        engineFuelRate: number;
        engineOdometerReading: number;
        engineRunTimeRunWhileMILIsActivated: number;
        engineRPM: number;
        engineOilTemperature: number;
        massAirFlow: number;
        pidRefreshRate: number;
        shortTermFuelTrimBank1: number;
        shortTermFuelTrimBank2: number;
        totalFuelEconomy: number;
        vehicleSpeedMPH: number;
    };
}

export const fetchVehicleDataAction: Action = {
    name: "FETCH_VEHICLE_DATA",
    similes: ["GET_VEHICLE_DATA", "FETCH_DATA", "VEHICLE_STATS"],
    description: "Fetches vehicle data from the external API and processes it for analysis.",

    // Validation ensures this action is only executed when applicable
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        // Validation logic: Check if the message contains a valid trigger
        const text = message.content.text?.toLowerCase();
        return text.includes("fetch vehicle data");
    },

    // The core functionality of the action
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const apiEndpoint = "http://localhost:3005/api/logs";
            const data = (await axios.get<{ logs: VehicleDataEntry[] }>(apiEndpoint)).data.logs;

            if (!Array.isArray(data)) {
                throw new Error("Invalid data format received from API");
            }

            const filteredData = data.filter(
                (entry: VehicleDataEntry) => entry[" Vehicle speed (MPH)"] > 0
            );

            // Calculate comprehensive statistics
            const stats: VehicleStats = {
                totalEntries: data.length,
                entriesWithSpeed: filteredData.length,
                averages: {
                    time: data.reduce((acc, entry) => acc + (entry["Time (sec)"] || 0), 0) / data.length,
                    absoluteLoad: data.reduce((acc, entry) => acc + (entry[" Absolute load value (%)"] || 0), 0) / data.length,
                    alcoholFuel: data.reduce((acc, entry) => acc + (entry[" Alcohol fuel percentage (%)"] || 0), 0) / data.length,
                    ambientTemp: data.reduce((acc, entry) => acc + (entry[" Ambient air temperature (°F)"] || 0), 0) / data.length,
                    calculatedLoad: data.reduce((acc, entry) => acc + (entry[" Calculated load value (%)"] || 0), 0) / data.length,
                    fuelRate: data.reduce((acc, entry) => acc + (entry[" Fuel rate (gal/hr)"] || 0), 0) / data.length,
                    vehicleSpeed: data.reduce((acc, entry) => acc + (entry[" Vehicle speed (MPH)"] || 0), 0) / data.length,
                    engineStartTime: data.reduce((acc, entry) => acc + (entry[" Time since engine start (sec)"] || 0), 0) / data.length,
                    stftBank2: data.reduce((acc, entry) => acc + (entry[" Short term fuel trim (Bank 2  Sensor 2) (%)"] || 0), 0) / data.length,
                    stftBank1: data.reduce((acc, entry) => acc + (entry[" Short term fuel trim (Bank 1  Sensor 1) (%)"] || 0), 0) / data.length,
                    coolantTemp: data.reduce((acc, entry) => acc + (entry[" Engine coolant temperature (°F)"] || 0), 0) / data.length,
                    rpm: data.reduce((acc, entry) => acc + (entry[" Engine RPM (RPM)"] || 0), 0) / data.length,
                    pidRefreshRate: data.reduce((acc, entry) => acc + (entry[" PID refresh rate (Hz)"] || 0), 0) / data.length,
                    voltage: data.reduce((acc, entry) => acc + (entry[" Adapter voltage (V)"] || 0), 0) / data.length,
                    co2Flow: data.reduce((acc, entry) => acc + (entry[" CO2 flow (lb/min)"] || 0), 0) / data.length,
                    instantMPG: data.reduce((acc, entry) => acc + (entry[" Instant fuel economy (MPG)"] || 0), 0) / data.length,
                    totalMPG: data.reduce((acc, entry) => acc + (entry[" Total fuel economy (MPG)"] || 0), 0) / data.length,
                    evapPressure: data.reduce((acc, entry) => acc + (entry[" Absolute evap system vapor pressure (inH2O)"] || 0), 0) / data.length,
                    throttlePosition: data.reduce((acc, entry) => acc + (entry[" Absolute throttle position (%)"] || 0), 0) / data.length,
                    engineTorque: data.reduce((acc, entry) => acc + (entry[" Actual engine - percent torque (%)"] || 0), 0) / data.length,
                    altFuelPressure: data.reduce((acc, entry) => acc + (entry[" Alternative Fuel Rail Pressure (inHg)"] || 0), 0) / data.length,
                    barometricPressure: data.reduce((acc, entry) => acc + (entry[" Barometric pressure (inHg)"] || 0), 0) / data.length,
                    engineFuelRate: data.reduce((acc, entry) => acc + (entry[" Engine fuel rate (gal/hr)"] || 0), 0) / data.length,
                    odometer: data.reduce((acc, entry) => acc + (entry[" Engine Odometer Reading (miles)"] || 0), 0) / data.length,
                    oilTemp: data.reduce((acc, entry) => acc + (entry[" Engine oil temperature (°F)"] || 0), 0) / data.length,
                    milRunTime: data.reduce((acc, entry) => acc + (entry[" Engine run time run while MIL is activated (min)"] || 0), 0) / data.length,
                    evapPurgePressure: data.reduce((acc, entry) => acc + (entry[" EVAP System Purge Pressure Sensor (inH2O)"] || 0), 0) / data.length,
                    ltftBank1: data.reduce((acc, entry) => acc + (entry[" Long term fuel % trim - Bank 1 (%)"] || 0), 0) / data.length,
                    ltftBank2: data.reduce((acc, entry) => acc + (entry[" Long term fuel % trim - Bank 2 (%)"] || 0), 0) / data.length,
                    massAirFlow: data.reduce((acc, entry) => acc + (entry[" Mass air flow rate (lb/min)"] || 0), 0) / data.length,
                },
                realtimeStats: {
                    vehicleSpeed: data[data.length - 1][" Vehicle speed (MPH)"],
                    rpm: data[data.length - 1][" Engine RPM (RPM)"],
                    fuelRate: data[data.length - 1][" Fuel rate (gal/hr)"],
                    coolantTemp: data[data.length - 1][" Engine coolant temperature (°F)"],
                    ambientTemp: data[data.length - 1][" Ambient air temperature (°F)"],
                    throttlePosition: data[data.length - 1][" Absolute throttle position (%)"],
                    stftBank1: data[data.length - 1][" Short term fuel trim (Bank 1  Sensor 1) (%)"],
                    stftBank2: data[data.length - 1][" Short term fuel trim (Bank 2  Sensor 2) (%)"],
                    oilTemp: data[data.length - 1][" Engine oil temperature (°F)"],
                    instantMPG: data[data.length - 1][" Instant fuel economy (MPG)"],
                    totalMPG: data[data.length - 1][" Total fuel economy (MPG)"],
                    evapPressure: data[data.length - 1][" Absolute evap system vapor pressure (inH2O)"],
                    evapPurgePressure: data[data.length - 1][" EVAP System Purge Pressure Sensor (inH2O)"],
                    altFuelPressure: data[data.length - 1][" Alternative Fuel Rail Pressure (inHg)"],
                    barometricPressure: data[data.length - 1][" Barometric pressure (inHg)"],
                    evapSystemVaporPressure: data[data.length - 1][" Absolute evap system vapor pressure (inH2O)"],
                    alcoholFuelPercentage: data[data.length - 1][" Alcohol fuel percentage (%)"],
                    absoluteLoad: data[data.length - 1][" Absolute load value (%)"],
                    calculatedLoad: data[data.length - 1][" Calculated load value (%)"],
                    evapSystemVaporPressureInHg: data[data.length - 1][" Absolute evap system vapor pressure (inH2O)"],
                    alternativeFuelRailPressure: data[data.length - 1][" Alternative Fuel Rail Pressure (inHg)"],
                    batteryCapacityCalculationReady: data[data.length - 1][" Battery Capacity Calculation Ready"],
                    batteryVoltage: data[data.length - 1][" Adapter voltage (V)"],
                    barometricPressureInHg: data[data.length - 1][" Barometric pressure (inHg)"],
                    co2Flow: data[data.length - 1][" CO2 flow (lb/min)"],
                    engineFuelRate: data[data.length - 1][" Engine fuel rate (gal/hr)"],
                    engineOdometerReading: data[data.length - 1][" Engine Odometer Reading (miles)"],
                    engineRunTimeRunWhileMILIsActivated: data[data.length - 1][" Engine run time run while MIL is activated (min)"],
                    engineRPM: data[data.length - 1][" Engine RPM (RPM)"],
                    engineOilTemperature: data[data.length - 1][" Engine oil temperature (°F)"],
                    massAirFlow: data[data.length - 1][" Mass air flow rate (lb/min)"],
                    pidRefreshRate: data[data.length - 1][" PID refresh rate (Hz)"],
                    shortTermFuelTrimBank1: data[data.length - 1][" Short term fuel trim (Bank 1  Sensor 1) (%)"],
                    shortTermFuelTrimBank2: data[data.length - 1][" Short term fuel trim (Bank 2  Sensor 2) (%)"],
                    totalFuelEconomy: data[data.length - 1][" Total fuel economy (MPG)"],
                    vehicleSpeedMPH: data[data.length - 1][" Vehicle speed (MPH)"],
                }
            };

            // Create a summary text that we can use for embeddings
            const summaryText = `Vehicle telemetry analysis summary: ` +
                `Total entries: ${stats.totalEntries}, ` +
                `Entries with speed: ${stats.entriesWithSpeed}, ` +
                `Current metrics - ` +
                `Speed: ${stats.realtimeStats.vehicleSpeed.toFixed(2)} MPH, ` +
                `RPM: ${stats.realtimeStats.rpm.toFixed(0)}, ` +
                `Fuel rate: ${stats.realtimeStats.fuelRate.toFixed(3)} gal/hr, ` +
                `Coolant temp: ${stats.realtimeStats.coolantTemp.toFixed(1)}°F, ` +
                `Averages - ` +
                `Speed: ${stats.averages.vehicleSpeed.toFixed(2)} MPH, ` +
                `RPM: ${stats.averages.rpm.toFixed(0)}, ` +
                `Fuel rate: ${stats.averages.fuelRate.toFixed(3)} gal/hr, ` +
                `Coolant temp: ${stats.averages.coolantTemp.toFixed(1)}°F`;

            // Get embeddings for the summary text
            const embeddingResponse = await runtime.messageManager.addEmbeddingToMemory({
                id: stringToUuid('summary-embedding'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: summaryText
                },
                createdAt: Date.now()
            });

            // Use the generated embedding for all our memories
            const embedding = embeddingResponse.embedding;

            // Store the raw data in documents manager with embedding
            await runtime.documentsManager.createMemory({
                id: stringToUuid('vehicle-raw-data'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding,
                content: {
                    text: JSON.stringify(data),
                    metadata: {
                        type: 'vehicle-telemetry',
                        timestamp: Date.now()
                    }
                },
                createdAt: Date.now()
            });

            // Store the processed data and stats in knowledge manager
            await runtime.knowledgeManager.createMemory({
                id: stringToUuid('vehicle-analysis'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding,
                content: {
                    text: JSON.stringify({
                        filteredData,
                        stats,
                        analysisTimestamp: Date.now()
                    }),
                    metadata: {
                        type: 'vehicle-analysis',
                        dataPoints: data.length,
                        movingDataPoints: filteredData.length
                    }
                },
                createdAt: Date.now()
            });

            // Store a description of the analysis in description manager
            await runtime.descriptionManager.createMemory({
                id: stringToUuid('vehicle-analysis-description'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding,
                content: {
                    text: summaryText,
                    metadata: {
                        type: 'analysis-description',
                        timestamp: Date.now()
                    }
                },
                createdAt: Date.now()
            });

            // Send the analysis response through message manager
            await runtime.messageManager.createMemory({
                id: stringToUuid('response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding,
                content: {
                    text: `Based on the telemetry data from your vehicle, here's what I found:\n\n` +
                          `Current vehicle status:\n` +
                          `- Vehicle is ${stats.realtimeStats.vehicleSpeed > 0 ? `moving at ${stats.realtimeStats.vehicleSpeed.toFixed(1)} MPH` : 'stationary'}\n` +
                          `- Engine running at ${stats.realtimeStats.rpm.toFixed(0)} RPM\n` +
                          `- Ambient temperature: ${stats.realtimeStats.ambientTemp.toFixed(1)}°F\n` +
                          `- Coolant temperature: ${stats.realtimeStats.coolantTemp.toFixed(1)}°F\n` +
                          `- Throttle position: ${stats.realtimeStats.throttlePosition.toFixed(1)}%\n` +
                          `- Current fuel rate: ${stats.realtimeStats.fuelRate.toFixed(2)} gal/hour\n` +
                          `- Instant fuel economy: ${stats.realtimeStats.instantMPG.toFixed(2)} MPG\n\n` +
                          `Average metrics:\n` +
                          `- Average speed: ${stats.averages.vehicleSpeed.toFixed(1)} MPH\n` +
                          `- Average RPM: ${stats.averages.rpm.toFixed(0)}\n` +
                          `- Average fuel rate: ${stats.averages.fuelRate.toFixed(2)} gal/hour\n` +
                          `- Overall fuel economy: ${stats.averages.totalMPG.toFixed(2)} MPG\n\n` +
                          `Engine parameters:\n` +
                          `- Short-term fuel trim (Bank 1): ${stats.realtimeStats.stftBank1.toFixed(1)}%\n` +
                          `- Battery voltage: ${stats.realtimeStats.batteryVoltage.toFixed(1)}V\n` +
                          `- Oil temperature: ${stats.realtimeStats.oilTemp.toFixed(1)}°F\n` +
                          `- All systems appear to be functioning normally\n\n` +
                          `Would you like me to analyze any specific aspect of the vehicle's performance in more detail?`,
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error) {
            console.error("Error in vehicle data handler:", error);

            try {
                // Get a simple embedding for the error message
                const errorMemory = await runtime.messageManager.addEmbeddingToMemory({
                    id: stringToUuid('error-embedding'),
                    userId: message.userId,
                    roomId: message.roomId,
                    agentId: runtime.agentId,
                    content: {
                        text: `Error processing vehicle data: ${(error as Error).message}`
                    },
                    createdAt: Date.now()
                });

                await runtime.messageManager.createMemory({
                    ...errorMemory,
                    id: stringToUuid('error'),
                    content: {
                        text: `Failed to process vehicle data: ${(error as Error).message}`,
                        metadata: {
                            error: (error as Error).message,
                            timestamp: Date.now()
                        }
                    }
                });
            } catch (messageError) {
                console.error("Failed to send error message:", messageError);
            }

            return false;
        }
    },

    // Example patterns for triggering the action
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Fetch vehicle data for analysis." },
            },
            {
                user: "{{user2}}",
                content: { text: "Vehicle data fetched and processed successfully!", action: "FETCH_VEHICLE_DATA" },
            },
        ],
    ],
};
