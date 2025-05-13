import { Evaluator, IAgentRuntime, Memory } from "@elizaos/core";

const autoPartsEvaluator: Evaluator = {
    name: "EVALUATE_AUTO_PARTS",
    description: "Evaluates the accuracy and relevance of auto parts search results.",
    similes: ["like a parts expert", "like a search engine for auto parts", "get parts data "],
    examples: [
        {
            context: "Evaluating search results for auto parts",
            messages: [
                { user: "{{user1}}", content: { text: "I am working on a Toyota Corolla 2020 and need a brake pad.  I need to know the part number, description, price, and availability.  I also need to know the manufacturer of the part.  I also need to know the link to the part if available." } },
                { user: "{{user2}}", content: { text: "I found the following parts for your Toyota Corolla 2020: 1) Brake Pad Part Number: 1234567890, Description: Brake Pad, Price: $100, Availability: In Stock, Manufacturer: Toyota, Link: https://www.oreillyauto.com/product/1234567890" } }
            ],
            outcome: "The search results are relevant and accurate."
        }
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        
        // Only trigger when EXPLICITLY asking for parts search
        return (
            // Must include explicit indication of part search intent
            (
                text.includes("find part") || 
                text.includes("search for part") || 
                text.includes("look up part") || 
                text.includes("find a part") || 
                text.includes("search parts") || 
                text.includes("need a part") ||
                text.includes("get part") || 
                text.includes("check part") ||
                (text.includes("auto part") && (text.includes("search") || text.includes("find") || text.includes("look"))) ||
                (text.includes("car part") && (text.includes("search") || text.includes("find") || text.includes("look")))
            )
        ) || text.includes("Automotive Parts Search Results"); // Still process results when they come back
    },

    handler: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text.toLowerCase();
        const isRelevant = text.includes("brake pad") || text.includes("engine") || text.includes("filter");

        if (!isRelevant) {
            console.warn("Irrelevant search results detected, refining search...");
            return "The search results may not be accurate. Consider refining your search query.";
        }

        return "Results appear to be relevant.";
    },
};

export default autoPartsEvaluator;
