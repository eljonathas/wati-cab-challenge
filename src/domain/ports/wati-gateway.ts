import type { Json } from "../agent.ts";

export interface Contact {
  readonly whatsappNumber: string;
  readonly name: string;
  readonly tags: string[];
  readonly customParams: Record<string, string>;
}

export interface Operator {
  readonly email: string;
  readonly teamName: string;
}

export interface MessageTemplate {
  readonly name: string;
  readonly content: string;
  readonly category: string;
  readonly parameterCount: number;
}

export interface WatiGateway {
  listContacts(filter?: {
    tag?: string;
    attribute?: { name: string; value: string };
  }): Promise<Contact[]>;

  getContactInfo(whatsappNumber: string): Promise<Contact | null>;

  addContact(
    whatsappNumber: string,
    name: string,
    customParams?: Array<{ name: string; value: string }>,
  ): Promise<Json>;

  updateContactAttributes(
    whatsappNumber: string,
    customParams: Array<{ name: string; value: string }>,
  ): Promise<Json>;

  addTag(whatsappNumber: string, tag: string): Promise<Json>;

  removeTag(whatsappNumber: string, tag: string): Promise<Json>;

  sendSessionMessage(whatsappNumber: string, messageText: string): Promise<Json>;

  sendTemplateMessage(
    whatsappNumber: string,
    templateName: string,
    parameters: Array<{ name: string; value: string }>,
  ): Promise<Json>;

  listTemplates(): Promise<MessageTemplate[]>;

  sendBroadcastToSegment(
    segmentName: string,
    templateName: string,
    broadcastName: string,
  ): Promise<Json>;

  assignTeam(whatsappNumber: string, teamName: string): Promise<Json>;

  assignOperator(whatsappNumber: string, email: string): Promise<Json>;

  listOperators(): Promise<Operator[]>;
}
