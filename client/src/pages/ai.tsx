import { useState, useEffect, useRef, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MessageCircle, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
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
          throw new Error("Não foi possível carregar o histórico");
        }
        const clone = response.clone();
        let data: any = null;
        try {
          data = await clone.json();
        } catch {
          const text = await response.text();
          throw new Error(text || "Histórico retornou formato inesperado");
        }
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
      } catch (error) {
        toast({
          title: "Histórico indisponível",
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
        content: "Processando...",
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

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-poppins">Assistente Inteligente</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Registre gastos, receitas e contas futuras conversando em linguagem natural. Estamos guardando seus comandos
          para que o FinScope AI consiga criar transações automaticamente nas próximas versões.
        </p>
      </div>

      <Card className="flex flex-col h-[70vh] overflow-hidden border-primary/10 shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/40">
          {isLoadingHistory ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <p>Carregando histórico…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full gap-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Converse comigo</p>
                <p className="text-sm">
                  Exemplos: “Gastei 50 reais no mercado hoje” ou “Preciso pagar 120 de luz dia 10”.
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
                      : "bg-background border border-border rounded-bl-sm"
                  )}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide mb-1 opacity-70">
                    {message.role === "user" ? "Você" : "FinScope AI"}
                    <span>·</span>
                    <span>{formatTime(message.createdAt)}</span>
                    {message.status === "pending" && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageCircle className="h-3 w-3 animate-pulse" />
                        enviando
                      </span>
                    )}
                    {message.status === "error" && <span className="text-[10px] text-rose-500">erro</span>}
                  </div>
                  <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
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
            placeholder="Ex.: Recebi 3.500 de salário"
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
