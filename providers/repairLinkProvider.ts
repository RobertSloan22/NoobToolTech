import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import fetch from "node-fetch";
import { parse } from "node-html-parser";

interface VehicleInfo {
    year: number;
    make: string;
    model: string;
    vin?: string;
}

interface PartInfo {
    partNumber?: string;
    description: string;
}

interface RepairLinkSearchRequest {
    request: {
        iDisplayLength: number;
        iDisplayStart: number;
        sFilterText: string;
        aFilterColumns: string[];
        sSortColumnName: string;
        sSortColumnDirection: string;
    };
    keyword: string;
    displayType: string;
    brandFilter: string;
    vehicle: {
        Year: number;
        MakeName: string;
        ModelName: string;
        VIN?: string;
        CatalogOemId: number;
        VinAttributes: any[];
        SelectedVehicleAttributes: any[];
        YearMakeModelAttributes: any[];
    };
    encryptedNodeId: number;
}

interface RepairLinkPartResult {
    name: string;
    manufacturer: string;
    price: number;
    partNumber: string;
    description: string;
    availability: string;
}

interface RepairLinkResponse {
    aaData: RepairLinkPartResult[];
}

interface VinResponse {
    success: boolean;
    message?: string;
}

class RepairLinkSession {
    private baseUrl: string = "https://repairlinkshop.com";
    private cookies: string[] = [];

    async login(): Promise<boolean> {
        try {
            // Initial login request
            const loginResponse = await fetch(`${this.baseUrl}/Account/Login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Origin": this.baseUrl,
                    "Referer": `${this.baseUrl}/Account/Login`
                },
                body: new URLSearchParams({
                    'UserName': 'hdauto',
                    'Password': 'hd1201',
                    'RememberUsername': 'false'
                }),
                redirect: 'follow'
            });

            if (!loginResponse.ok) {
                throw new Error(`Login failed: ${loginResponse.status}`);
            }

            // Store cookies from login response
            const loginCookies = loginResponse.headers.raw()['set-cookie'];
            if (loginCookies) {
                this.cookies = loginCookies;
            }

            // Verify login success
            const html = await loginResponse.text();
            if (html.includes('Invalid username or password')) {
                return false;
            }

            return true;
        } catch (error) {
            console.error("Login error:", error);
            return false;
        }
    }

    async setVehicleByVin(vin: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/AutomotiveCatalog/SetVehicleByVin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json, text/javascript, */*; q=0.01",
                    "X-Requested-With": "XMLHttpRequest",
                    "Origin": this.baseUrl,
                    "Referer": `${this.baseUrl}/AutomotiveCatalog`,
                    "Cookie": this.cookies.join("; ")
                },
                body: new URLSearchParams({
                    'vin': vin
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to set VIN: ${response.status}`);
            }

            const result = await response.json() as VinResponse;
            return result.success;
        } catch (error) {
            console.error("Set VIN error:", error);
            return false;
        }
    }

    async searchParts(vehicle: VehicleInfo, part: PartInfo): Promise<RepairLinkPartResult[]> {
        const searchRequest: RepairLinkSearchRequest = {
            request: {
                iDisplayLength: 25,
                iDisplayStart: 0,
                sFilterText: part.description,
                aFilterColumns: [],
                sSortColumnName: "",
                sSortColumnDirection: ""
            },
            keyword: part.description,
            displayType: "list",
            brandFilter: "0",
            vehicle: {
                Year: vehicle.year,
                MakeName: vehicle.make,
                ModelName: vehicle.model,
                VIN: vehicle.vin,
                CatalogOemId: 8,
                VinAttributes: [],
                SelectedVehicleAttributes: [],
                YearMakeModelAttributes: []
            },
            encryptedNodeId: 0
        };

        const response = await fetch(`${this.baseUrl}/AutomotiveCatalog/GetPartsForKeyword`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "Origin": this.baseUrl,
                "Referer": this.baseUrl,
                "Cookie": this.cookies.join("; ")
            },
            body: JSON.stringify(searchRequest)
        });

        if (!response.ok) {
            throw new Error(`Parts search failed: ${response.status}`);
        }

        const data = await response.json() as RepairLinkResponse;
        return data.aaData || [];
    }
}

const repairlinkProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Parse the query to extract vehicle and part information
            const [year, make, model, partDesc, vin] = message.content.text.split(",").map(s => s.trim());
            
            if (!year || !make || !model || !partDesc) {
                return "Please provide the search in format: year, make, model, part description[, VIN]";
            }

            const vehicle: VehicleInfo = {
                year: parseInt(year),
                make,
                model,
                vin: vin // Add VIN if provided
            };

            const part: PartInfo = {
                description: partDesc
            };

            // Create a new session and login
            const session = new RepairLinkSession();
            const loginSuccess = await session.login();

            if (!loginSuccess) {
                return "Failed to authenticate with RepairLink";
            }

            // If VIN is provided, set it first
            if (vin) {
                const vinSuccess = await session.setVehicleByVin(vin);
                if (!vinSuccess) {
                    return "Failed to set vehicle VIN";
                }
            }

            // Search for parts
            const results = await session.searchParts(vehicle, part);

            if (!results.length) {
                return "No parts found matching your search criteria";
            }

            // Format results
            const formattedResults = results
                .map(item => `${item.name} - Price: ${item.price} - Manufacturer: ${item.manufacturer} - Part Number: ${item.partNumber} - Description: ${item.description} - Availability: ${item.availability}`)
                .join("\n");

            return `RepairLink Search Results:\n${formattedResults}`;
        } catch (error) {
            console.error("RepairLink provider error:", error);
            return "Sorry, I couldn't fetch parts data from RepairLink right now.";
        }
    },
};

export default repairlinkProvider; 