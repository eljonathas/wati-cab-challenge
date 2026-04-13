import type { Json } from "../../domain/agent.ts";
import type {
  Contact,
  Operator,
  MessageTemplate,
  WatiGateway,
} from "../../domain/ports/wati-gateway.ts";

export class MockWatiGateway implements WatiGateway {
  private readonly contacts: Array<{
    whatsappNumber: string;
    name: string;
    tags: string[];
    customParams: Record<string, string>;
    lastContactedAt?: string;
  }> = [
    {
      whatsappNumber: "6281234567890",
      name: "Ayu",
      tags: ["VIP"],
      customParams: { city: "Jakarta", plan: "premium" },
      lastContactedAt: "2026-03-20T09:15:00.000Z",
    },
    {
      whatsappNumber: "6289876543210",
      name: "Rizky",
      tags: ["trial"],
      customParams: { city: "Bandung", plan: "free" },
      lastContactedAt: "2026-04-11T14:02:00.000Z",
    },
    {
      whatsappNumber: "6281112223333",
      name: "Nadia",
      tags: ["VIP", "renewal"],
      customParams: { city: "Jakarta", plan: "premium" },
      lastContactedAt: "2026-04-04T11:30:00.000Z",
    },
    {
      whatsappNumber: "6281444555666",
      name: "Budi",
      tags: ["churned"],
      customParams: { city: "Surabaya", plan: "basic" },
      lastContactedAt: "2026-02-01T08:00:00.000Z",
    },
  ];

  private readonly operators: Operator[] = [
    { email: "agent@company.com", teamName: "Support" },
    { email: "sales@company.com", teamName: "Sales" },
    { email: "manager@company.com", teamName: "Support" },
  ];

  private readonly templates: MessageTemplate[] = [
    {
      name: "renewal_reminder",
      content:
        "Hi {{name}}, your subscription is about to expire. Renew now to continue enjoying our service!",
      category: "UTILITY",
      parameterCount: 1,
    },
    {
      name: "flash_sale",
      content:
        "Don't miss our flash sale, {{name}}! Get 50% off on all plans for the next 24 hours.",
      category: "MARKETING",
      parameterCount: 2,
    },
    {
      name: "welcome_message",
      content:
        "Welcome to our service, {{name}}! We're excited to have you on board.",
      category: "UTILITY",
      parameterCount: 1,
    },
    {
      name: "order_confirmation",
      content:
        "Hi {{name}}, your order has been confirmed! We'll notify you once it's shipped.",
      category: "UTILITY",
      parameterCount: 3,
    },
  ];

  async listContacts(filter?: {
    name?: string;
    tag?: string;
    attribute?: { name: string; value: string };
  }): Promise<Contact[]> {
    return this.contacts.filter((c) => {
      if (
        filter?.name &&
        !c.name.toLowerCase().includes(filter.name.toLowerCase())
      )
        return false;
      if (filter?.tag && !c.tags.includes(filter.tag)) return false;
      if (
        filter?.attribute &&
        c.customParams[filter.attribute.name] !== filter.attribute.value
      )
        return false;
      return true;
    });
  }

  async listContactsByLastActivity(filter: {
    notContactedSinceDays: number;
    tag?: string;
    includeNeverContacted?: boolean;
  }): Promise<Contact[]> {
    if (
      !Number.isFinite(filter.notContactedSinceDays) ||
      filter.notContactedSinceDays < 0
    ) {
      throw new Error("notContactedSinceDays must be a non-negative number.");
    }

    const includeNeverContacted = filter.includeNeverContacted ?? true;
    const cutoff =
      Date.now() - filter.notContactedSinceDays * 24 * 60 * 60 * 1000;

    return this.contacts.filter((contact) => {
      if (filter.tag && !contact.tags.includes(filter.tag)) return false;

      if (contact.lastContactedAt === undefined) {
        return includeNeverContacted;
      }

      const lastContactedMs = Date.parse(contact.lastContactedAt);
      if (Number.isNaN(lastContactedMs)) return includeNeverContacted;

      return lastContactedMs <= cutoff;
    });
  }

  async getContactInfo(whatsappNumber: string): Promise<Contact | null> {
    return (
      this.contacts.find((contact) => contact.whatsappNumber === whatsappNumber) ??
      null
    );
  }

  async addContact(
    whatsappNumber: string,
    name: string,
    customParams?: Array<{ name: string; value: string }>,
  ): Promise<Json> {
    if (this.contacts.some((contact) => contact.whatsappNumber === whatsappNumber)) {
      throw new Error(`Contact ${whatsappNumber} already exists.`);
    }

    const attributes = Object.fromEntries(
      (customParams ?? []).map((param) => [param.name, param.value]),
    );

    this.contacts.push({
      whatsappNumber,
      name,
      tags: [],
      customParams: attributes,
    });

    return { whatsappNumber, name, customParams: attributes, status: "contact_created" };
  }

  async updateContactAttributes(
    whatsappNumber: string,
    customParams: Array<{ name: string; value: string }>,
  ): Promise<Json> {
    const contact = this.contacts.find(
      (entry) => entry.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    for (const param of customParams) {
      contact.customParams[param.name] = param.value;
    }

    return {
      whatsappNumber,
      updatedFields: customParams.map((param) => param.name),
      status: "attributes_updated",
    };
  }

  async addTag(whatsappNumber: string, tag: string): Promise<Json> {
    const contact = this.contacts.find(
      (c) => c.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    if (!contact.tags.includes(tag)) contact.tags.push(tag);
    return { whatsappNumber, tag, status: "tag_added" };
  }

  async removeTag(whatsappNumber: string, tag: string): Promise<Json> {
    const contact = this.contacts.find(
      (entry) => entry.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    contact.tags = contact.tags.filter((entry) => entry !== tag);
    return { whatsappNumber, tag, status: "tag_removed" };
  }

  async sendSessionMessage(
    whatsappNumber: string,
    messageText: string,
  ): Promise<Json> {
    const contact = this.contacts.find(
      (entry) => entry.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    contact.lastContactedAt = new Date().toISOString();
    return { whatsappNumber, messageText, status: "session_message_sent" };
  }

  async listTemplates(): Promise<MessageTemplate[]> {
    return [...this.templates];
  }

  async sendTemplateMessage(
    whatsappNumber: string,
    templateName: string,
    parameters: Array<{ name: string; value: string }>,
  ): Promise<Json> {
    const contact = this.contacts.find(
      (c) => c.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    const template = this.templates.find((entry) => entry.name === templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found.`);
    }

    contact.lastContactedAt = new Date().toISOString();
    return {
      whatsappNumber,
      templateName,
      parameters,
      status: "template_message_queued",
    };
  }

  async sendBroadcastToSegment(
    segmentName: string,
    templateName: string,
    broadcastName: string,
  ): Promise<Json> {
    const template = this.templates.find((entry) => entry.name === templateName);
    if (!template) throw new Error(`Template '${templateName}' not found.`);

    return {
      segmentName,
      templateName,
      broadcastName,
      status: "broadcast_queued",
    };
  }

  async assignTeam(whatsappNumber: string, teamName: string): Promise<Json> {
    const contact = this.contacts.find(
      (c) => c.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    const teamExists = this.operators.some(
      (operator) => operator.teamName === teamName,
    );
    if (!teamExists) throw new Error(`Team '${teamName}' not found.`);

    return { whatsappNumber, teamName, status: "team_assigned" };
  }

  async assignOperator(whatsappNumber: string, email: string): Promise<Json> {
    const contact = this.contacts.find(
      (entry) => entry.whatsappNumber === whatsappNumber,
    );
    if (!contact) throw new Error(`Contact ${whatsappNumber} not found.`);

    const operator = this.operators.find((entry) => entry.email === email);
    if (!operator) throw new Error(`Operator '${email}' not found.`);

    return {
      whatsappNumber,
      email,
      teamName: operator.teamName,
      status: "operator_assigned",
    };
  }

  async listOperators(): Promise<Operator[]> {
    return [...this.operators];
  }
}
