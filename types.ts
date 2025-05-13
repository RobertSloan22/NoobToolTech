import { ConversationCategory } from "./evaluators/conversationRouterEvaluator";

// Action example interface
export interface ActionExample {
  context?: string;
  messages: Array<{
    user: string;
    content: {
      text: string;
    };
  }>;
  outcome: string;
}

// Evaluation data interfaces
export interface DtcEvaluationData {
  dtcCodes: Array<{
    code: string;
    description?: string;
    system?: string;
    severity?: string;
  }>;
  needsAdditionalInfo?: boolean;
  suggestedActions?: string[];
}

export interface RoutingEvaluationData {
  category: ConversationCategory;
  urgency: "high" | "medium" | "low";
  complexity: "high" | "medium" | "low";
  explicitRouting: string | null;
  suggestedActions: string[];
}

// Vehicle interface used by providers
export interface Vehicle {
  _id?: string;
  year: number | string;
  make: string;
  model: string;
  engine?: string;
  transmission?: string;
}

// Extend the State interface to include our custom state properties
declare module '@elizaos/core' {
  interface State {
    lastDtcEvaluation?: DtcEvaluationData;
    lastRoutingEvaluation?: RoutingEvaluationData;
    conversationRouting?: any;
    lastRoutingTimestamp?: string;
    activeConversationThreads?: any[];
    currentVehicle?: Vehicle;
    lastDtcLookup?: {
      codes: string[];
      timestamp: string;
      result: any;
    };
  }
} 