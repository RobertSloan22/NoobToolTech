import { Provider, IAgentRuntime, Memory, State } from "@elizaos/core";
import puppeteer, { Page } from 'puppeteer';
import * as cheerio from 'cheerio';

interface AutoPart {
    name: string;
    manufacturer: string;
    price: number;
    partNumber: string;
    description: string;
    image?: string;
    link: string;
    availability: string;
}

interface AutoPartsResponse {
    items: AutoPart[];
    totalResults: number;
}

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
];

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const EMAIL = 'rstechsolutionsmeco@gmail.com';
const PASSWORD = 'AcQsz%fpbG4Pp_j';

async function loginToOReilly(page: Page): Promise<boolean> {
    try {
        console.log('Attempting to log in...');
        
        // Navigate to login page
        await page.goto('https://www.oreillyauto.com/signin', {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Wait for login form - using the correct selectors from the page
        await page.waitForSelector('#signInEmailAddress');
        await page.waitForSelector('#signInPassword');

        // Type credentials
        await page.type('#signInEmailAddress', EMAIL);
        await page.type('#signInPassword', PASSWORD);

        // Submit form - using the correct button class
        const submitButton = await page.waitForSelector('.login-btn.js-login-btn');
        if (submitButton) {
            await submitButton.click();
        }

        // Wait for login to complete - looking for account-specific elements
        await Promise.race([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.waitForSelector('.header-account, [data-qa="desktop-header-account"]'),
            delay(10000)
        ]);

        // Verify login success
        const isLoggedIn = await page.evaluate(() => {
            return document.querySelector('.header-account, [data-qa="desktop-header-account"]') !== null ||
                   document.querySelector('.account-header') !== null;
        });

        console.log(isLoggedIn ? 'Login successful' : 'Login may have failed');
        return isLoggedIn;
    } catch (error) {
        console.error('Login error:', error);
        return false;
    }
}

async function scrapeAutoPartsData(url: string, retryCount = 0): Promise<AutoPartsResponse> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();
        
        // Set a random user agent
        const userAgent = getRandomUserAgent();
        await page.setUserAgent(userAgent);
        
        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Add headers to look more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        });

        // Attempt to login first
        const loginSuccess = await loginToOReilly(page);
        if (!loginSuccess && retryCount === 0) {
            console.log('Login failed, will try search without authentication');
        }

        // Navigate to the search page
        console.log('Navigating to:', url);
        await page.goto(url, { 
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        // Wait for dynamic content
        await delay(2000);

        // Wait for specific O'Reilly selectors
        await Promise.race([
            page.waitForSelector('.search-results__products'),
            page.waitForSelector('.product-grid'),
            page.waitForSelector('.product-list'),
            delay(5000) // Timeout after 5 seconds
        ]);

        // Get the page content
        const content = await page.content();
        const $ = cheerio.load(content);

        const items: AutoPart[] = [];

        // O'Reilly specific selectors
        const productElements = [
            '.search-results__products .product-pod',
            '.product-grid .product-pod',
            '.product-list .product-pod',
            '[data-testid="product-pod"]'
        ];

        productElements.forEach(selector => {
            $(selector).each((_, element: any) => {
                const $el = $(element);
                
                // Extract product data using O'Reilly's specific class names
                const name = $el.find('.product-pod__title').text().trim() ||
                           $el.find('[data-testid="product-title"]').text().trim();
                           
                const priceText = $el.find('.product-pod__price-amount').text().trim() ||
                                $el.find('[data-testid="product-price"]').text().trim();
                const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                
                const manufacturer = $el.find('.product-pod__brand').text().trim() ||
                                   $el.find('[data-testid="product-brand"]').text().trim();
                                   
                const partNumber = $el.find('.product-pod__part-number').text().trim() ||
                                 $el.find('[data-testid="product-number"]').text().trim();
                                 
                const description = $el.find('.product-pod__description').text().trim() ||
                                  $el.find('[data-testid="product-description"]').text().trim();
                                  
                const image = $el.find('.product-pod__image img').attr('src') ||
                            $el.find('[data-testid="product-image"] img').attr('src') || '';
                            
                const link = $el.find('.product-pod__title-link').attr('href') ||
                           $el.find('[data-testid="product-title-link"]').attr('href') || '';
                           
                const availability = $el.find('.product-pod__availability').text().trim() ||
                                   $el.find('[data-testid="product-availability"]').text().trim() ||
                                   'Check store for availability';

                if (name || price) {
                    console.log('Found product:', { name, price, manufacturer, partNumber });
                    items.push({
                        name: name || 'Unknown Product',
                        manufacturer: manufacturer || 'Unknown Manufacturer',
                        price,
                        partNumber: partNumber || 'N/A',
                        description: description || '',
                        image,
                        link: link.startsWith('http') ? link : `https://www.oreillyauto.com${link}`,
                        availability
                    });
                }
            });
        });

        // If no items found with primary selectors, try backup approach
        if (items.length === 0) {
            console.log('No products found with primary selectors, trying backup approach...');
            
            // Look for any elements that might contain product information
            $('[class*="product"], [class*="item"]').each((_, element: any) => {
                const $el = $(element);
                const text = $el.text();
                
                // Look for price patterns
                const priceMatch = text.match(/\$\s*(\d+\.?\d*)/);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1]);
                    const surroundingText = text.substring(0, 200);
                    console.log('Found potential product:', { text: surroundingText, price });
                    
                    // Try to extract a name from nearby headings or strong text
                    const name = $el.find('h1, h2, h3, h4, strong').first().text().trim();
                    
                    items.push({
                        name: name || 'Unknown Product',
                        manufacturer: 'Unknown Manufacturer',
                        price,
                        partNumber: 'N/A',
                        description: surroundingText,
                        image: '',
                        link: url,
                        availability: 'Check store for availability'
                    });
                }
            });
        }

        return {
            items,
            totalResults: items.length
        };
    } catch (error) {
        console.error('Scraping error:', error);
        if (retryCount < MAX_RETRIES) {
            console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
            await browser.close();
            await delay(RETRY_DELAY);
            return scrapeAutoPartsData(url, retryCount + 1);
        }
        throw error;
    } finally {
        await browser.close();
    }
}

const automotivePartsProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        const query = message.content.text;
        
        // Extract part names from the query
        const partTerms = query.toLowerCase()
            .replace(/can you get( the)? pricing for( the)?/g, '')
            .replace(/price[s]? for/g, '')
            .split(/(?:and|,)/)
            .map(term => term.trim())
            .filter(term => term.length > 0);
            
        console.log('Searching for parts:', partTerms);
        
        const results: AutoPart[] = [];
        
        for (const partTerm of partTerms) {
            const searchUrl = `https://www.oreillyauto.com/search?q=${encodeURIComponent(partTerm)}`;
            try {
                console.log('Trying URL:', searchUrl);
                const partResults = await scrapeAutoPartsData(searchUrl);
                if (partResults.items.length > 0) {
                    results.push(...partResults.items);
                }
            } catch (error) {
                console.error(`Error searching for "${partTerm}":`, error);
            }
            // Add delay between searches to avoid rate limiting
            await delay(1000);
        }
        
        if (results.length === 0) {
            return "Sorry, I couldn't find any matching parts. The website may be blocking automated access. Please try searching directly on O'Reilly's website: https://www.oreillyauto.com/";
        }

        const formattedResults = results
            .map(item => {
                const lines = [
                    `Name: ${item.name}`,
                    `Price: $${item.price.toFixed(2)}`,
                ];

                if (item.manufacturer) lines.push(`Manufacturer: ${item.manufacturer}`);
                if (item.partNumber) lines.push(`Part Number: ${item.partNumber}`);
                if (item.availability) lines.push(`Availability: ${item.availability}`);
                if (item.link) lines.push(`Link: ${item.link}`);
                
                lines.push('---');
                return lines.join('\n');
            })
            .join('\n');

        return `Found ${results.length} automotive parts:\n\n${formattedResults}`;
    },
};

export default automotivePartsProvider;
