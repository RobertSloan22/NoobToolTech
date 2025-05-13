import { Service, ServiceType } from '@elizaos/core';
import { IEmailService, SendEmailOptions, EmailResponse } from '@elizaos/plugin-email';
import nodemailer from 'nodemailer';
import imaps from 'imap-simple';

export class EmailService implements IEmailService {
  serviceType = 'email' as ServiceType;
  name = 'emailService';
  private transporter: any;
  private imapConnection: any;

  constructor(private config: {
    service: string;
    auth: {
      user: string;
      pass: string;
    };
    host: string;
    port: string | number;
  }) {}

  async initialize(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      service: this.config.service,
      auth: this.config.auth
    });
  }

  async send(options: SendEmailOptions): Promise<EmailResponse> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.auth.user,
        ...options
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Send failed' };
    }
  }

  async receive(callback: (mail: any) => void): Promise<void> {
    const config = {
      imap: {
        user: this.config.auth.user,
        password: this.config.auth.pass,
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
        connTimeout: 10000,
        keepalive: true,
        debug: console.log
      }
    };

    try {
      console.log('Attempting to connect to IMAP server...', {
        host: config.imap.host,
        port: config.imap.port,
        user: config.imap.user
      });
      
      const connection = await imaps.connect(config);
      this.imapConnection = connection;
      
      await connection.openBox('INBOX');
      
      // Search for emails from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const searchCriteria = ['UNSEEN', ['SINCE', yesterday]];
      const fetchOptions = {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
        markSeen: false
      };

      const messages = await connection.search(searchCriteria, fetchOptions);
      
      for (const message of messages) {
        const header = message.parts.find(part => part.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
        const body = message.parts.find(part => part.which === 'TEXT');
        
        const emailContent = {
          from: header?.body?.from?.[0] || '',
          subject: header?.body?.subject?.[0] || '',
          date: header?.body?.date?.[0] || '',
          text: body?.body || '',
        };

        callback(emailContent);
      }

      await connection.end();
    } catch (error) {
      console.error('Error receiving emails:', error);
      throw error;
    }
  }
} 