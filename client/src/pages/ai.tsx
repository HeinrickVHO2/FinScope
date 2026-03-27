import { useState, useEffect, useRef, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MessageCircle, Sparkles, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { AssistantRichMessage } from "@/components/assistant-rich-message";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
  status?: "sent" | "pending" | "error";
};

export default function AIClientPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingBotId, setPendingBotId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { toast } = useToast();
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await apiFetch("/api/ai/chat?limit=150", {
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar o historico");
        }
        const clone = response.clone();
        let data: any = null;
        try {
          data = await clone.json();
        } catch {
          const text = await response.text();
          throw new Error(text || "Historico retornou formato inesperado");
        }
        if (Array.isArray(data?.messages)) {
          setMessages(
            data.messages.map((item: any) => ({
              id: item.id,
              role: item.role,
              content: item.content,
              payload: item.payload ?? null,
              createdAt: item.createdAt,
            })),
          );
        }
      } catch (error) {
        toast({
          title: "Historico indisponivel",
          description: (error as Error).message,
          variant: "destructive",
        });
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [toast]);

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
        content: "Estou organizando isso para voce...",
        createdAt: new Date().toISOString(),
        payload: null,
        status: "pending",
      };

      setMessages((prev) => [...prev, tempUserMessage, tempBotMessage]);
      setPendingBotId(tempBotMessage.id);
      setInputValue("");

      const response = await apiFetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: tempUserMessage.content,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Nao foi possivel enviar a mensagem." }));
        throw new Error(errorData.error || "Erro ao enviar mensagem.");
      }

      const data = await response.json();
      const userMessage = data?.data?.userMessage as ChatMessage | undefined;
      const assistantMessage = data?.data?.assistantMessage as ChatMessage | undefined;
      const assistantPayload = data?.data?.payload ?? assistantMessage?.payload ?? null;

      if (userMessage && assistantMessage) {
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id === tempBotMessage.id) {
              return { ...assistantMessage, payload: assistantPayload };
            }
            if (message.id === tempUserMessage.id) {
              return userMessage;
            }
            return message;
          }),
        );

        const actions = data?.data?.actions || [];
        if (actions.length > 0) {
          for (const action of actions) {
            if (action.type === "transaction" && action.data) {
              console.log("[AI Action] Transacao criada:", action.data);
            } else if (action.type === "future_bill" && action.data) {
              console.log("[AI Action] Conta futura criada:", action.data);
            } else if (action.type === "goal" && action.data) {
              console.log("[AI Action] Meta criada:", action.data);
            }
          }
          window.dispatchEvent(new CustomEvent("ai-action-completed", { detail: { actions } }));
        }
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
        }),
      );
      toast({
        title: "Nao foi possivel enviar sua mensagem",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setPendingBotId(null);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold font-poppins">Assistente com IA</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Me conte suas movimentacoes e eu ajudo a registrar tudo. O padrao e a conta pessoal. Para lancar na empresa, mencione isso explicitamente e tenha sua conta PJ criada antes em PJ/Minha Empresa.
          </p>
        </div>
      </div>

      <Card className="flex flex-col h-[70vh] overflow-hidden border-primary/10 shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/40">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <p>Carregando historico...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Converse comigo</p>
                <p className="text-sm">
                  Exemplos: "Gastei 50 reais no mercado hoje" ou "Recebi 1200 na empresa". Se voce nao falar nada, eu registro na conta pessoal.
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
                    "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-background border border-border rounded-bl-sm",
                  )}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide mb-1 opacity-70">
                    {message.role === "user" ? "Voce" : "FinScope IA"}
                    <span>·</span>
                    <span>{formatTime(message.createdAt)}</span>
                    {message.status === "pending" && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageCircle className="h-3 w-3 animate-pulse" />
                        digitando
                      </span>
                    )}
                    {message.status === "error" && <span className="text-[10px] text-rose-500">erro</span>}
                    {message.status === "sent" && message.role === "assistant" && (
                      <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                        <Check className="h-3 w-3" />
                        registrado
                      </span>
                    )}
                  </div>
                  {message.status === "pending" && message.role === "assistant" ? (
                    <div className="flex items-center gap-1">
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-muted-foreground" style={{ animationDelay: "0ms" }}></span>
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-muted-foreground" style={{ animationDelay: "150ms" }}></span>
                      <span className="animate-bounce inline-block h-2 w-2 rounded-full bg-muted-foreground" style={{ animationDelay: "300ms" }}></span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {message.role === "assistant" && message.content.includes("{")
                          ? message.content.split("\n\n")[0] || message.content
                          : message.content}
                      </p>
                      {message.role === "assistant" && <AssistantRichMessage payload={message.payload} />}
                    </div>
                  )}
                  {message.status === "error" && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-primary underline"
                      onClick={() => {
                        setInputValue(message.content);
                        setMessages((prev) => prev.filter((item) => item.id !== message.id));
                      }}
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <form onSubmit={handleSend} className="border-t bg-background p-4 flex items-center gap-3">
          <Input
            placeholder="Ex.: Recebi 3.500 de salario"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            className="flex-1"
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !inputValue.trim()}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {isSending ? "Enviando..." : "Enviar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
