import type { Json } from "../../domain/agent.ts";
import type { WatiGateway } from "../../domain/ports/wati-gateway.ts";
import { Tool } from "../tools/tool.decorator.ts";

export class WatiTools {
  constructor(private readonly gateway: WatiGateway) {}

  @Tool(
    "wati.list_contacts",
    "List contacts. All filters are optional. If called without filters, it lists all contacts. For requests like 'where attribute = value', use attributeName='attribute' and attributeValue='value'.",
    [
      {
        name: "tag",
        type: "string",
        description: "Optional tag filter (e.g. 'VIP').",
      },
      {
        name: "attributeName",
        type: "string",
        description: "Optional custom attribute name filter (e.g. 'city').",
      },
      {
        name: "attributeValue",
        type: "string",
        description:
          "Optional custom attribute value to match (e.g. 'Jakarta'). Use together with attributeName.",
      },
    ],
  )
  async listContacts(input: Record<string, Json>): Promise<unknown> {
    const tag = typeof input.tag === "string" ? input.tag : undefined;
    const attributeName =
      typeof input.attributeName === "string" ? input.attributeName : undefined;
    const attributeValue =
      typeof input.attributeValue === "string"
        ? input.attributeValue
        : undefined;

    return this.gateway.listContacts({
      tag,
      attribute:
        attributeName && attributeValue
          ? { name: attributeName, value: attributeValue }
          : undefined,
    });
  }

  @Tool(
    "wati.get_contact_info",
    "Get detailed info for a single contact by WhatsApp number.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
    ],
  )
  async getContactInfo(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.getContactInfo(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
    );
  }

  @Tool(
    "wati.add_contact",
    "Create a new contact with optional custom attributes.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
      {
        name: "name",
        type: "string",
        description: "The contact's display name.",
        required: true,
      },
      {
        name: "customParams",
        type: "array",
        description: "Custom attributes as [{name, value}].",
        items: {
          name: "param",
          type: "object",
          description: "A {name, value} pair.",
        },
      },
    ],
  )
  async addContact(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.addContact(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.name, "name"),
      this.parseNameValueArray(input.customParams),
    );
  }

  @Tool(
    "wati.update_contact_attributes",
    "Update custom attributes of an existing contact.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
      {
        name: "customParams",
        type: "array",
        description: "Attributes to set as [{name, value}].",
        required: true,
        items: {
          name: "param",
          type: "object",
          description: "A {name, value} pair.",
        },
      },
    ],
  )
  async updateContactAttributes(input: Record<string, Json>): Promise<unknown> {
    const customParams = this.parseNameValueArray(input.customParams);
    if (customParams.length === 0) {
      throw new Error(
        "customParams must contain at least one {name, value} pair.",
      );
    }

    return this.gateway.updateContactAttributes(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      customParams,
    );
  }

  @Tool("wati.add_tag", "Add a tag to a contact.", [
    {
      name: "whatsappNumber",
      type: "string",
      description: "The contact's WhatsApp number.",
      required: true,
    },
    {
      name: "tag",
      type: "string",
      description: "Tag to add (e.g. 'VIP').",
      required: true,
    },
  ])
  async addTag(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.addTag(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.tag, "tag"),
    );
  }

  @Tool("wati.remove_tag", "Remove a tag from a contact.", [
    {
      name: "whatsappNumber",
      type: "string",
      description: "The contact's WhatsApp number.",
      required: true,
    },
    {
      name: "tag",
      type: "string",
      description: "Tag to remove.",
      required: true,
    },
  ])
  async removeTag(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.removeTag(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.tag, "tag"),
    );
  }

  @Tool(
    "wati.send_session_message",
    "Send a plain text session message to one contact.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
      {
        name: "messageText",
        type: "string",
        description: "The text message to send.",
        required: true,
      },
    ],
  )
  async sendSessionMessage(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.sendSessionMessage(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.messageText, "messageText"),
    );
  }

  @Tool(
    "wati.send_template_message",
    "Send a template message to a single contact with personalized parameters.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
      {
        name: "templateName",
        type: "string",
        description: "Name of the approved template.",
        required: true,
      },
      {
        name: "parameters",
        type: "array",
        description: "Template parameters as [{name, value}].",
        items: {
          name: "param",
          type: "object",
          description: "A {name, value} pair.",
        },
      },
    ],
  )
  async sendTemplateMessage(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.sendTemplateMessage(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.templateName, "templateName"),
      this.parseNameValueArray(input.parameters),
    );
  }

  @Tool(
    "wati.list_message_templates",
    "List available message templates. No parameters required.",
  )
  async listMessageTemplates(): Promise<unknown> {
    return this.gateway.listTemplates();
  }

  @Tool(
    "wati.send_broadcast_to_segment",
    "Send a template broadcast to an existing segment.",
    [
      {
        name: "segmentName",
        type: "string",
        description: "Name of the target segment.",
        required: true,
      },
      {
        name: "templateName",
        type: "string",
        description: "Name of the approved template.",
        required: true,
      },
      {
        name: "broadcastName",
        type: "string",
        description: "Unique name for this broadcast.",
        required: true,
      },
    ],
  )
  async sendBroadcastToSegment(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.sendBroadcastToSegment(
      this.requireString(input.segmentName, "segmentName"),
      this.requireString(input.templateName, "templateName"),
      this.requireString(input.broadcastName, "broadcastName"),
    );
  }

  @Tool("wati.assign_team", "Assign a contact's conversation to a team.", [
    {
      name: "whatsappNumber",
      type: "string",
      description: "The contact's WhatsApp number.",
      required: true,
    },
    {
      name: "teamName",
      type: "string",
      description: "Team name (e.g. 'Support').",
      required: true,
    },
  ])
  async assignTeam(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.assignTeam(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.teamName, "teamName"),
    );
  }

  @Tool(
    "wati.assign_operator",
    "Assign a contact's conversation to a specific operator by email.",
    [
      {
        name: "whatsappNumber",
        type: "string",
        description: "The contact's WhatsApp number.",
        required: true,
      },
      {
        name: "email",
        type: "string",
        description: "Operator email address.",
        required: true,
      },
    ],
  )
  async assignOperator(input: Record<string, Json>): Promise<unknown> {
    return this.gateway.assignOperator(
      this.requireString(input.whatsappNumber, "whatsappNumber"),
      this.requireString(input.email, "email"),
    );
  }

  @Tool("wati.list_operators", "List available operators and their teams.")
  async listOperators(): Promise<unknown> {
    return this.gateway.listOperators();
  }

  private parseNameValueArray(
    value: Json | undefined,
  ): Array<{ name: string; value: string }> {
    return Array.isArray(value)
      ? value.flatMap((item) => {
          if (typeof item !== "object" || item === null) return [];
          const entry = item as Record<string, Json>;
          if (
            typeof entry.name !== "string" ||
            typeof entry.value !== "string"
          ) {
            return [];
          }
          return [{ name: entry.name, value: entry.value }];
        })
      : [];
  }

  private requireString(value: Json | undefined, field: string): string {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Missing required field: ${field}`);
    }
    return value;
  }
}
