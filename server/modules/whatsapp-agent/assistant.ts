import type { IStorage } from "../../storage";
import {
  buildFinancialAssistantResponse as buildSharedFinancialAssistantResponse,
  buildFinancialAssistantReply as buildSharedFinancialAssistantReply,
  looksLikeFinanceAssistantQuestion as looksLikeSharedFinanceAssistantQuestion,
} from "../shared/financialAssistant";

export function looksLikeFinanceAssistantQuestion(text: string) {
  return looksLikeSharedFinanceAssistantQuestion(text);
}

export async function buildFinanceAssistantResponse(storage: IStorage, userId: string, text: string) {
  return buildSharedFinancialAssistantResponse(storage, userId, text, "whatsapp");
}

export async function buildFinanceAssistantReply(storage: IStorage, userId: string, text: string) {
  return buildSharedFinancialAssistantReply(storage, userId, text, "whatsapp");
}
