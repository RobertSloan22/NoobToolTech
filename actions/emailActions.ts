import { Action, ActionResponse, IAgentRuntime, Memory, State, stringToUuid, ServiceType } from "@elizaos/core";
import { IEmailService, SendEmailOptions } from "@elizaos/plugin-email";
import { getErrorMessage } from '../utils/errorHandling.ts';

interface EmailParameters {
    to: string;
    subject: string;
    body: string;
    isHtml?: boolean;
}

interface EmailContent {
    from: string;
    subject: string;
    date: string;
    text?: string;
    html?: string;
}

// Add this interface to properly type the services
interface RuntimeServices {
    email: IEmailService;
}

export const sendCustomerEmailAction: Action = {
    name: "SEND_CUSTOMER_EMAIL",
    similes: ["SEND_EMAIL", "EMAIL_CUSTOMER", "SEND_MESSAGE"],
    description: "Sends an email to a customer with optional HTML content",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return text.includes("send email") || 
               text.includes("send a message") ||
               text.includes("compose email") ||
               text.includes("write email");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const emailService = runtime.services.get('email' as ServiceType) as IEmailService;
            if (!emailService) {
                console.error('Email service not available');
                return false;
            }

            // Extract email details from message
            const emailDetails = {
                to: message.content.to || 'rsloanrob@gmail.com',  // Default or extracted email
                subject: message.content.subject || 'Good Morning',
                text: message.content.text || 'Good morning Bobby.'
            };

            console.log('Sending email with details:', emailDetails);  // Debug log
            
            const result = await emailService.send(emailDetails as SendEmailOptions);
            return result.success;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    },

    // Example patterns for triggering the action
    examples: [
        [
            {
                user: "{{user1}}",
                content: { 
                    text: "Send an email to customer@example.com",
                    parameters: {
                        to: "customer@example.com",
                        subject: "Vehicle Maintenance Reminder",
                        body: "Your vehicle is due for maintenance.",
                        isHtml: false
                    }
                },
            },
            {
                user: "{{user2}}",
                content: { 
                    text: "Email sent successfully!",
                    action: "SEND_CUSTOMER_EMAIL"
                },
            },
        ],
    ],
};

export const getCustomerEmailsAction: Action = {
    name: "GET_CUSTOMER_EMAILS",
    similes: ["READ_EMAILS", "CHECK_INBOX", "FETCH_EMAILS"],
    description: "Retrieves and processes customer emails from the inbox",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase() || '';
        return text.includes("check") && text.includes("email") ||
               text.includes("get emails") || 
               text.includes("check inbox") ||
               text.includes("fetch emails") ||
               text.includes("read emails") ||
               text.includes("show emails") ||
               text.includes("recent emails");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            const emailService = runtime.services.get("email" as ServiceType) as IEmailService;
            if (!emailService) {
                throw new Error("Email service not found");
            }

            console.log("Starting email retrieval...");
            const emails: EmailContent[] = [];

            await new Promise<void>((resolve) => {
                emailService.receive((mail: EmailContent) => {
                    console.log("Received email:", mail);
                    emails.push(mail);
                });
                setTimeout(resolve, 10000);
            });

            console.log(`Retrieved ${emails.length} emails`);

            // Create response text
            const responseText = emails.length > 0 
                ? `Found ${emails.length} emails:\n\n${emails.map(email => 
                    `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n---`
                  ).join('\n')}`
                : "No new emails found in inbox.";

            // First create the embedding
            const embeddedMemory = await runtime.messageManager.addEmbeddingToMemory({
                id: stringToUuid('emails-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: { text: responseText },
                createdAt: Date.now()
            });

            if (!embeddedMemory.embedding) {
                throw new Error("Failed to generate embedding for response");
            }

            // Now create the memory with the confirmed embedding
            await runtime.messageManager.createMemory(embeddedMemory);

            // Send a simple response directly
            await runtime.messageManager.createMemory({
                id: stringToUuid('direct-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: { text: responseText },
                createdAt: Date.now(),
                unique: true // Prevent duplicate responses
            });

            return true;
        } catch (error: unknown) {
            console.error("Error retrieving emails:", error);
            
            // Send a simple error response without embedding
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId || stringToUuid('default-room'),
                agentId: runtime.agentId,
                content: { text: `Error retrieving emails: ${getErrorMessage(error)}` },
                createdAt: Date.now(),
            });

            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Check my inbox for new emails." },
            },
            {
                user: "{{user2}}",
                content: { text: "Retrieved emails from inbox", action: "GET_CUSTOMER_EMAILS" },
            },
        ],
    ],
}; 