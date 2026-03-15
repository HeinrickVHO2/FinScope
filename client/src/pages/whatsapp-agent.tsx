import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Smartphone, Link2, Copy, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Account } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type WhatsAppSession = {
  eligible: boolean;
  billingStatus: string;
  plan: string;
  instructions: string[];
  businessPhone: string | null;
  conversationUrl: string | null;
  binding: {
    isLinked: boolean;
    phone: string | null;
    provider: string | null;
    verified: boolean;
  };
  pendingBinding: {
    phone: string;
    code: string;
    expiresAt: string;
  } | null;
};

type Candidate = {
  id: string;
  proposedType: "income" | "expense";
  amount: number;
  currency: string;
  description: string;
  merchantName: string | null;
  categorySuggestion: string | null;
  transactionDate: string;
  confidenceScore: number | null;
  status: string;
};

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}

export default function WhatsAppAgentPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [phone, setPhone] = useState("");
  const [accountByCandidate, setAccountByCandidate] = useState<Record<string, string>>({});

  const sessionQuery = useQuery<WhatsAppSession>({
    queryKey: ["/api/whatsapp/session"],
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: Boolean(sessionQuery.data?.eligible),
  });

  const candidatesQuery = useQuery<Candidate[]>({
    queryKey: ["/api/whatsapp/candidates"],
    enabled: Boolean(sessionQuery.data?.eligible && sessionQuery.data?.binding.isLinked),
  });

  const refreshWhatsAppData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/session"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PF"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PJ"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=ALL"] }),
    ]);
  };

  const startBindingMutation = useMutation({
    mutationFn: async () => {
      console.log("[WHATSAPP UI] tentativa de vínculo", { phone });
      const response = await apiRequest("POST", "/api/whatsapp/binding/start", { phone });
      return response.json();
    },
    onSuccess: async () => {
      console.log("[WHATSAPP UI] código de vínculo gerado");
      await refreshWhatsAppData();
      toast({
        title: "Código gerado",
        description: "Envie esse código para o WhatsApp do FinScope para concluir a conexão.",
      });
    },
    onError: (error: Error) => {
      console.error("[WHATSAPP UI] falha de requisição no vínculo", error);
      toast({
        title: "Não foi possível conectar agora",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      console.log("[WHATSAPP UI] removendo vínculo");
      const response = await apiRequest("DELETE", "/api/whatsapp/binding");
      return response.json();
    },
    onSuccess: async () => {
      console.log("[WHATSAPP UI] vínculo removido");
      await refreshWhatsAppData();
      toast({
        title: "Número desconectado",
        description: "Você pode conectar outro número quando quiser.",
      });
    },
    onError: (error: Error) => {
      console.error("[WHATSAPP UI] falha ao remover vínculo", error);
      toast({
        title: "Não foi possível remover o número",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const accountId = accountByCandidate[candidateId];
      console.log("[WHATSAPP UI] confirmando sugestão", { candidateId, accountId });
      const response = await apiRequest("POST", `/api/whatsapp/candidates/${candidateId}/confirm`, {
        accountId,
      });
      return response.json();
    },
    onSuccess: async () => {
      console.log("[WHATSAPP UI] sugestão confirmada");
      await refreshWhatsAppData();
      toast({
        title: "Transação salva",
        description: "A sugestão foi confirmada e entrou no seu histórico.",
      });
    },
    onError: (error: Error) => {
      console.error("[WHATSAPP UI] falha ao confirmar sugestão", error);
      toast({
        title: "Não foi possível confirmar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      console.log("[WHATSAPP UI] ignorando sugestão", { candidateId });
      const response = await apiRequest("POST", `/api/whatsapp/candidates/${candidateId}/ignore`);
      return response.json();
    },
    onSuccess: async () => {
      console.log("[WHATSAPP UI] sugestão ignorada");
      await refreshWhatsAppData();
      toast({
        title: "Sugestão ignorada",
        description: "Ela saiu da sua lista de revisão.",
      });
    },
    onError: (error: Error) => {
      console.error("[WHATSAPP UI] falha ao ignorar sugestão", error);
      toast({
        title: "Não foi possível ignorar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingCandidates = useMemo(
    () => (candidatesQuery.data || []).filter((candidate) => candidate.status === "pending_review"),
    [candidatesQuery.data],
  );

  const session = sessionQuery.data;

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">WhatsApp</p>
        <h1 className="text-3xl font-poppins font-bold">Conectar WhatsApp</h1>
        <p className="max-w-2xl text-muted-foreground">
          Envie seus gastos e recebimentos por mensagem. O FinScope transforma isso em sugestões para você revisar antes de salvar.
        </p>
      </div>

      {!session ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Carregando status do WhatsApp...
          </CardContent>
        </Card>
      ) : null}

      {session ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Status do recurso
                </CardTitle>
                <CardDescription>Disponível para assinantes ativos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className={session.eligible ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                    {session.eligible ? "Assinatura ativa" : "Assinatura pendente"}
                  </Badge>
                  <Badge className={session.binding.isLinked ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}>
                    {session.binding.isLinked ? "Número vinculado" : "Número não vinculado"}
                  </Badge>
                </div>

                {!session.eligible ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Ative sua assinatura para usar o WhatsApp</AlertTitle>
                    <AlertDescription>
                      Assim que o pagamento estiver ativo, você poderá conectar seu número e enviar mensagens direto por aqui.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {session.binding.isLinked ? (
                  <div className="rounded-xl border bg-slate-50 p-4">
                    <p className="text-sm text-muted-foreground">Número vinculado</p>
                    <p className="mt-1 text-lg font-semibold">{session.binding.phone}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Nenhum número conectado por enquanto.
                  </div>
                )}

                {session.eligible && session.binding.isLinked && session.conversationUrl ? (
                  <a href={session.conversationUrl} target="_blank" rel="noreferrer">
                    <Button className="w-full sm:w-auto">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Abrir conversa no WhatsApp
                    </Button>
                  </a>
                ) : null}

                {session.eligible && session.binding.isLinked && !session.conversationUrl ? (
                  <p className="text-sm text-muted-foreground">
                    O link da conversa ficará disponível assim que o número do FinScope estiver configurado.
                  </p>
                ) : null}

                {session.binding.isLinked ? (
                  <Button
                    variant="outline"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {disconnectMutation.isPending ? "Removendo..." : "Remover vínculo"}
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Conectar número
                </CardTitle>
                <CardDescription>Você informa o número e confirma a posse enviando um código pelo WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Ex.: +55 11 99999-9999"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={!session.eligible}
                  />
                  <Button
                    onClick={() => startBindingMutation.mutate()}
                    disabled={!session.eligible || startBindingMutation.isPending}
                  >
                    {startBindingMutation.isPending ? "Gerando código..." : "Conectar número"}
                  </Button>
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  {session.instructions.map((instruction) => (
                    <div key={instruction} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      <span>{instruction}</span>
                    </div>
                  ))}
                </div>

                {session.pendingBinding ? (
                  <div className="rounded-2xl border bg-emerald-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Código para enviar pelo WhatsApp</p>
                        <p className="mt-1 text-3xl font-bold tracking-[0.24em]">{session.pendingBinding.code}</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Número informado: {session.pendingBinding.phone}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Válido até {new Date(session.pendingBinding.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            console.log("[WHATSAPP UI] copiando código de vínculo");
                            await navigator.clipboard.writeText(session.pendingBinding!.code);
                            toast({
                              title: "Código copiado",
                              description: "Agora é só enviar pelo WhatsApp.",
                            });
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copiar código
                        </Button>
                        {session.businessPhone ? (
                          <a
                            href={`https://wa.me/${session.businessPhone.replace(/\D+/g, "")}?text=${encodeURIComponent(session.pendingBinding.code)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button variant="secondary">Abrir conversa</Button>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Aguardando revisão
              </CardTitle>
              <CardDescription>Revise cada sugestão antes de salvar como transação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session.eligible ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Este espaço fica liberado assim que sua assinatura estiver ativa.
                </div>
              ) : null}

              {session.eligible && !session.binding.isLinked ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Conecte seu número para começar a receber sugestões.
                </div>
              ) : null}

              {session.eligible && session.binding.isLinked && candidatesQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Carregando sugestões...
                </div>
              ) : null}

              {session.eligible && session.binding.isLinked && !pendingCandidates.length && !candidatesQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhuma sugestão aguardando revisão.
                </div>
              ) : null}

              {pendingCandidates.map((candidate) => (
                <div key={candidate.id} className="rounded-2xl border p-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{candidate.description}</p>
                      <Badge variant="secondary">
                        {candidate.proposedType === "income" ? "Recebimento" : "Gasto"}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {formatDate(candidate.transactionDate)} · {formatCurrency(candidate.amount)}
                      {candidate.confidenceScore !== null ? ` · confiança ${Math.round(candidate.confidenceScore * 100)}%` : ""}
                    </p>

                    {candidate.merchantName ? (
                      <p className="text-sm text-muted-foreground">Local: {candidate.merchantName}</p>
                    ) : null}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        value={accountByCandidate[candidate.id] || ""}
                        onValueChange={(value) => {
                          console.log("[WHATSAPP UI] atualização de estado da conta", { candidateId: candidate.id, value });
                          setAccountByCandidate((current) => ({ ...current, [candidate.id]: value }));
                        }}
                      >
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <SelectValue placeholder="Escolha a conta" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button onClick={() => confirmMutation.mutate(candidate.id)} disabled={confirmMutation.isPending}>
                        Confirmar
                      </Button>
                      <Button variant="outline" onClick={() => ignoreMutation.mutate(candidate.id)} disabled={ignoreMutation.isPending}>
                        Ignorar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-slate-50 p-4 text-sm text-muted-foreground">
        Exemplos: “gastei 89,90 no mercado”, “recebi 2500 de cliente”.
        {user?.billingStatus !== "active" ? " Este recurso aparece aqui, mas só processa mensagens com assinatura ativa." : ""}
      </div>
    </div>
  );
}
