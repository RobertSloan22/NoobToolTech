import { Provider, IAgentRuntime, Memory, State, elizaLogger } from '@elizaos/core';
import { IEmailService } from '@elizaos/plugin-email';

interface NamedProvider extends Provider {
  name: string;
}

export const emailProvider: NamedProvider = {
  name: "@elizaos/plugin-email",
  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    try {
      // Log available plugins with more details
      elizaLogger.debug('Available plugins:', runtime.plugins.map(p => p.name));
      
      const emailPlugin = runtime.plugins.find(p => p.name === '@elizaos/plugin-email');
      
      if (!emailPlugin) {
        elizaLogger.error('Email plugin not found');
        return null;
      }

      // Initialize plugin if needed
      if (!emailPlugin.services?.length) {
        elizaLogger.debug('Email plugin found but no services');
        return null;
      }

      const emailService = emailPlugin.services[0];
      if (!emailService || !('send' in emailService) || !('receive' in emailService)) {
        elizaLogger.error("Email service does not have required methods");
        return null;
      }
      return emailService as unknown as IEmailService;
    } catch (error) {
      elizaLogger.error("Error in emailProvider:", error);
      return null;
    }
  }
}; 