import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import * as puppeteer from "puppeteer";
import { Buffer } from 'buffer';

interface VehicleInfo {
    year: number;
    make: string;
    model: string;
    subModel?: string;
}

interface PartInfo {
    description: string;
}

interface PartResult {
    name: string;
    price: string;
    partNumber: string;
    description: string;
    brand: string;
    availability?: string;
}

interface SearchResponse {
    results: PartResult[];
    pdfBuffer: Uint8Array;
}

class OreillySession {
    private browser: puppeteer.Browser | null = null;
    private page: puppeteer.Page | null = null;
    private timeout = 5000;

    async initialize(): Promise<boolean> {
        try {
            this.browser = await puppeteer.launch({ headless: false });
            this.page = await this.browser.newPage();
            this.page.setDefaultTimeout(this.timeout);

            await this.page.setViewport({
                width: 1905,
                height: 911
            });

            // Navigate to O'Reilly Auto Parts
            await this.page.goto('https://www.oreillyauto.com/');

            // Click sign in button
            await this.page.waitForSelector('li.header-menu__item--account');
            await this.page.click('li.header-menu__item--account');

            // Wait for and fill in login credentials
            await this.page.waitForSelector('#email');
            await this.page.type('#email', 'autohd');
            await this.page.type('#password', 'hdauto');

            // Click the sign in button
            await this.page.waitForSelector('button[type="submit"]');
            await this.page.click('button[type="submit"]');

            // Wait for login to complete
            await this.page.waitForNavigation();

            return true;
        } catch (error) {
            console.error("Failed to initialize O'Reilly session:", error);
            return false;
        }
    }

    async setVehicle(vehicle: VehicleInfo): Promise<boolean> {
        try {
            if (!this.page) throw new Error("Page not initialized");

            // Click the vehicle selector
            await this.page.waitForSelector('li.header-menu__item--garage span.header-icon-button-text--desktop > span.header-icon-button-text--control');
            await this.page.click('li.header-menu__item--garage span.header-icon-button-text--desktop > span.header-icon-button-text--control');

            // Select Year
            await this.page.waitForSelector('#ivs-u9a73jur-input');
            await this.page.click('#ivs-u9a73jur-input');
            await this.page.waitForSelector(`[aria-label="${vehicle.year}"]`);
            await this.page.click(`[aria-label="${vehicle.year}"]`);

            // Select Make
            await this.page.waitForSelector(`[aria-label="${vehicle.make}"]`);
            await this.page.click(`[aria-label="${vehicle.make}"]`);

            // Select Model
            await this.page.waitForSelector('#ivs-cqy2er8b-input');
            await this.page.click('#ivs-cqy2er8b-input');
            await this.page.waitForSelector(`[aria-label="${vehicle.model}"]`);
            await this.page.click(`[aria-label="${vehicle.model}"]`);

            // Select Sub-Model if provided
            if (vehicle.subModel) {
                await this.page.waitForSelector(`[aria-label="${vehicle.subModel}"]`);
                await this.page.click(`[aria-label="${vehicle.subModel}"]`);
            }

            // Click Add Vehicle
            await this.page.waitForSelector('[aria-label="ADD VEHICLE"]');
            await this.page.click('[aria-label="ADD VEHICLE"]');

            return true;
        } catch (error) {
            console.error("Failed to set vehicle:", error);
            return false;
        }
    }

    async searchParts(part: PartInfo): Promise<SearchResponse> {
        try {
            if (!this.page) throw new Error("Page not initialized");

            // Click search input
            await this.page.waitForSelector('[data-qa="header-search-input"]');
            await this.page.click('[data-qa="header-search-input"]');

            // Type search query
            await this.page.type('[data-qa="header-search-input"]', part.description);
            await this.page.keyboard.press('Enter');

            // Wait for results and give time for all content to load
            await this.page.waitForSelector('div.product-container');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for dynamic content

            // Generate PDF from the page
            const pdfData = await this.page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            // Extract product information
            const results = await this.page.evaluate(() => {
                const products = document.querySelectorAll('div.product-container article');
                return Array.from(products).map(product => ({
                    name: product.querySelector('h2')?.textContent?.trim() || '',
                    price: product.querySelector('.price')?.textContent?.trim() || '',
                    partNumber: product.querySelector('.part-number')?.textContent?.trim() || '',
                    description: product.querySelector('.description')?.textContent?.trim() || '',
                    brand: product.querySelector('.brand')?.textContent?.trim() || '',
                    availability: product.querySelector('.availability')?.textContent?.trim()
                }));
            });

            return {
                results,
                pdfBuffer: new Uint8Array(pdfData)
            };
        } catch (error) {
            console.error("Failed to search parts:", error);
            return {
                results: [],
                pdfBuffer: new Uint8Array()
            };
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

const oreillyAutoPartsProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            // Parse the query to extract vehicle and part information
            const [year, make, model, subModel, partDesc] = message.content.text.split(",").map(s => s.trim());
            
            if (!year || !make || !model || !partDesc) {
                return "Please provide the search in format: year, make, model[, sub-model], part description";
            }

            const vehicle: VehicleInfo = {
                year: parseInt(year),
                make,
                model,
                subModel: subModel
            };

            const part: PartInfo = {
                description: partDesc
            };

            // Create a new session
            const session = new OreillySession();
            const initialized = await session.initialize();

            if (!initialized) {
                return "Failed to initialize O'Reilly Auto Parts session";
            }

            // Set vehicle
            const vehicleSet = await session.setVehicle(vehicle);
            if (!vehicleSet) {
                await session.close();
                return "Failed to set vehicle information";
            }

            // Search for parts
            const { results, pdfBuffer } = await session.searchParts(part);
            await session.close();

            if (!results.length) {
                return "No parts found matching your search criteria";
            }

            // Format results
            const formattedResults = results
                .map(item => `${item.name} - Price: ${item.price} - Part #: ${item.partNumber} - Brand: ${item.brand}${item.availability ? ` - Availability: ${item.availability}` : ''}`)
                .join("\n");

            // Return both text results and PDF buffer
            return [{
                text: `O'Reilly Auto Parts Search Results:\n${formattedResults}`,
                attachments: [],
                source: "oreillyAutoPartsProvider",
                pdfBuffer: Array.from(pdfBuffer)
            }];
        } catch (error) {
            console.error("O'Reilly Auto Parts provider error:", error);
            return "Sorry, I couldn't fetch parts data from O'Reilly Auto Parts right now.";
        }
    },
};

export default oreillyAutoPartsProvider; 