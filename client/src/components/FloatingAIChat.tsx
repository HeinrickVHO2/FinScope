import { useState, useEffect, useRef, useCallback, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MessageSquareText, X, Sparkles, Loader2 } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "sent" | "pending" | "error";
};

export function FloatingAIChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingBotId, setPendingBotId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const fetchHistory = useCallback(async () => {
    if (isLoadingHistory) return;
    setIsLoadingHistory(true);
    try {
      const response = await apiFetch("/api/ai/chat?limit=120", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error("Não foi possível carregar o histórico.");
      }
      const data = await response.json();
      if (Array.isArray(data?.messages)) {
        setMessages(
          data.messages.map((item: any) => ({
            id: item.id,
            role: item.role,
            content: item.content,
            createdAt: item.createdAt,
          }))
        );
      }
      setHasLoadedHistory(true);
    } catch (error) {
      toast({
        title: "Histórico indisponível",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isLoadingHistory, toast]);

  useEffect(() => {
    if (isOpen && !hasLoadedHistory && user) {
      fetchHistory();
    }
  }, [fetchHistory, hasLoadedHistory, isOpen, user]);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleToggle = () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isSending) {
      return;
    }

    setIsSending(true);
    try {
      const tempUserMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: inputValue.trim(),
        createdAt: new Date().toISOString(),
        status: "sent",
      };
      const tempBotMessage: ChatMessage = {
        id: `temp-bot-${Date.now()}`,
        role: "assistant",
        content: "Fluxo inteligente em processamento...",
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      setMessages((prev) => [...prev, tempUserMessage, tempBotMessage]);
      setPendingBotId(tempBotMessage.id);
      setInputValue("");

      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: tempUserMessage.content }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Não foi possível enviar a mensagem." }));
        throw new Error(errorData.error || "Erro ao enviar mensagem.");
      }

      const data = await response.json();
      const userMessage = data?.data?.userMessage as ChatMessage | undefined;
      const assistantMessage = data?.data?.assistantMessage as ChatMessage | undefined;

      if (userMessage && assistantMessage) {
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id === tempBotMessage.id) {
              return assistantMessage;
            }
            if (message.id === tempUserMessage.id) {
              return userMessage;
            }
            return message;
          })
        );
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id === pendingBotId || message.status === "pending") {
            return {
              ...message,
              content: "Falha ao enviar. Tentar novamente?",
              status: "error",
            };
          }
          return message;
        })
      );
      toast({
        title: "Não foi possível enviar sua mensagem",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setPendingBotId(null);
    }
  };

  return (
    <div className="fixed bottom-8 right-5 sm:bottom-12 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <Card className="w-[320px] sm:w-[380px] h-[420px] shadow-2xl border border-slate-200 flex flex-col bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">FinScope AI</p>
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Assistente inteligente
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Registre gastos, receitas e compromissos futuros.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setIsOpen(false)}
              aria-label="Fechar chat AI"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/40">
            {isLoadingHistory ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Buscando conversas...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground px-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">Converse comigo</p>
                  <p className="text-xs text-muted-foreground">
                    Exemplos: “Gastei 50 no mercado” ou “Tenho aluguel de 300 dia 10”.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm relative",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    )}
                  >
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide mb-1 opacity-70">
                      {message.role === "user" ? "Você" : "FinScope AI"}
                      <span>·</span>
                      <span>{formatTime(message.createdAt)}</span>
                      {message.status === "pending" && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          enviando
                        </span>
                      )}
                      {message.status === "error" && (
                        <span className="text-[10px] text-rose-500">erro</span>
                      )}
                    </div>
                    <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={handleSend} className="border-t bg-background p-3 flex items-center gap-2">
            <Input
              placeholder="Ex.: Recebi 2.000 de salário"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              disabled={isSending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isSending || !inputValue.trim()}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </form>
        </Card>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            className="h-14 w-14 rounded-full shadow-xl"
            onClick={handleToggle}
            aria-label="Abrir chat com FinScope AI"
          >
            <MessageSquareText className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <span>Conversar com o FinScope AI</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
