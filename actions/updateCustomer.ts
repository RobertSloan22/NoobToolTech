import { Action, IAgentRuntime, Memory, State, stringToUuid } from "@elizaos/core";
import axios from "axios";
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'f9e0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6';
const API_BASE_URL = 'http://localhost:5000/api';

// Helper function to get auth headers
function getAuthHeaders() {
    const token = jwt.sign({ id: 'eliza-agent' }, JWT_SECRET, { expiresIn: '1h' });
    return {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
}

interface CustomerData {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    workphoneNumber?: number;
    address: string;
    city: string;
    zipCode: string;
    notes: string;
    preferredContact: 'email' | 'phone' | 'text';
    vehicles: Array<{
        year: number;
        make: string;
        model: string;
        trim?: string;
        vin?: string;
        licensePlate?: string;
        color?: string;
        mileage?: number;
        engine?: string;
        turbocharged?: boolean;
        transmission?: string;
        fuelType?: string;
        isAWD?: boolean;
        is4x4?: boolean;
        notes?: string;
        status?: string;
    }>;
}



export const updateCustomerAction: Action = {
    name: "UPDATE_CUSTOMER",
    similes: ["MODIFY_CUSTOMER", "EDIT_CUSTOMER"],
    description: "Updates an existing customer's information",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.toLowerCase();
        return text.includes("update customer") || text.includes("modify customer") || text.includes("edit customer");
    },

    handler: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        try {
            if (!message.userId) {
                throw new Error("No userId provided in message");
            }

            const text = message.content.text;
            const customerId = text.match(/\b([0-9a-fA-F]{24})\b/)?.[1];
            
            if (!customerId) {
                throw new Error("No customer ID provided in message");
            }

            const updateData = extractCustomerData(text);

            const response = await axios.put(
                `${API_BASE_URL}/customers/${customerId}`,
                updateData,
                getAuthHeaders()
            );
            const updatedCustomer = response.data;

            const summaryText = `Updated customer: ${updatedCustomer.firstName} ${updatedCustomer.lastName}`;

            const embeddingResponse = await runtime.messageManager.addEmbeddingToMemory({
                id: stringToUuid('update-customer-summary'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: { text: summaryText },
                createdAt: Date.now()
            });

            await runtime.messageManager.createMemory({
                id: stringToUuid('update-customer-response'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                embedding: embeddingResponse.embedding,
                content: {
                    text: `Successfully updated customer:\n` +
                          `- Name: ${updatedCustomer.firstName} ${updatedCustomer.lastName}\n` +
                          `- Email: ${updatedCustomer.email}\n` +
                          `- Phone: ${updatedCustomer.phoneNumber}\n` +
                          `- Address: ${updatedCustomer.address}, ${updatedCustomer.city} ${updatedCustomer.zipCode}`,
                    metadata: {
                        type: 'customer-updated',
                        customerId: updatedCustomer._id
                    }
                },
                createdAt: Date.now()
            });

            return true;
        } catch (error) {
            console.error("Error updating customer:", error);
            await runtime.messageManager.createMemory({
                id: stringToUuid('error'),
                userId: message.userId,
                roomId: message.roomId,
                agentId: runtime.agentId,
                content: {
                    text: `Failed to update customer: ${(error as Error).message}`,
                    metadata: { error: (error as Error).message }
                },
                createdAt: Date.now()
            });
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Update customer 507f1f77bcf86cd799439011 email to new@example.com" },
            },
            {
                user: "{{user2}}",
                content: { text: "Customer updated successfully", action: "UPDATE_CUSTOMER" },
            },
        ],
    ],
};

// Helper function to extract customer data from message text
function extractCustomerData(text: string): Partial<CustomerData> {
    const data: Partial<CustomerData> = {};
    
    // Extract name
    const nameMatch = text.match(/(?:name:|customer\s+)([A-Za-z]+\s+[A-Za-z]+)/i);
    if (nameMatch) {
        const [firstName, lastName] = nameMatch[1].split(' ');
        data.firstName = firstName;
        data.lastName = lastName;
    }

    // Extract email
    const emailMatch = text.match(/email:\s*([^\s,]+@[^\s,]+)/i);
    if (emailMatch) {
        data.email = emailMatch[1];
    }

    // Extract phone
    const phoneMatch = text.match(/phone:\s*([\d-]+)/i);
    if (phoneMatch) {
        data.phoneNumber = phoneMatch[1];
    }

    // Extract address
    const addressMatch = text.match(/address:\s*([^,]+),\s*([^,]+),\s*(\d{5})/i);
    if (addressMatch) {
        data.address = addressMatch[1];
        data.city = addressMatch[2];
        data.zipCode = addressMatch[3];
    }

    // Extract preferred contact method
    const contactMatch = text.match(/preferred\s+contact:\s*(email|phone|text)/i);
    if (contactMatch) {
        data.preferredContact = contactMatch[1] as 'email' | 'phone' | 'text';
    }

    return data;
} 