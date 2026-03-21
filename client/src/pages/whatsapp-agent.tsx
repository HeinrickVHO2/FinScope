import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MessageCircle, Smartphone, Link2, Copy, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Account } from "@shared/schema";
import { buildWhatsAppConversationUrl, normalizePhone } from "@shared/whatsapp-phone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UpgradeModal from "@/components/UpgradeModal";
import { canUseWhatsAppAgent } from "@shared/plans";

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

type ReviewItem = {
  candidateId: string;
  status: string;
  confidenceScore: number | null;
  proposedType: "income" | "expense";
  amount: number;
  currency: string;
  description: string;
  categorySuggestion: string | null;
  merchantName: string | null;
  transactionDate: string;
  persistedTransactionId: string | null;
  evidence: Record<string, any> | null;
  createdAt: string | null;
  updatedAt: string | null;
  inboundMessage: {
    id: string;
    textBody: string | null;
    fromPhone: string;
    receivedAt: string | null;
    status: string;
  } | null;
  mediaEvidence: Array<{
    id: string;
    mimeType: string | null;
    storagePath: string;
    status: string;
    ocrText: string | null;
  }>;
  transaction: {
    id: string;
    accountId: string;
    description: string;
    amount: string;
    type: string;
    category: string;
    date: string;
    accountType: string;
    source: string;
  } | null;
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
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [accountByCandidate, setAccountByCandidate] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [draftByCandidate, setDraftByCandidate] = useState<Record<string, {
    description: string;
    amount: string;
    category: string;
    date: string;
  }>>({});

  const hasWhatsAppAccess = canUseWhatsAppAgent(user?.plan);

  const sessionQuery = useQuery<WhatsAppSession>({
    queryKey: ["/api/whatsapp/session"],
    enabled: hasWhatsAppAccess,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    enabled: Boolean(sessionQuery.data?.eligible),
  });

  const reviewItemsQuery = useQuery<ReviewItem[]>({
    queryKey: ["/api/whatsapp/review-items"],
    enabled: Boolean(sessionQuery.data?.eligible && sessionQuery.data?.binding.isLinked),
  });

  const refreshWhatsAppData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/session"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/review-items"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PF"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PJ"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=ALL"] }),
    ]);
  };

  const startBindingMutation = useMutation({
    mutationFn: async () => {
      console.log("[WHATSAPP UI] tentativa de vínculo", { phone });
      console.log("[WHATSAPP UI] telefone normalizado para vinculo", {
        rawPhone: phone,
        normalizedPhone: normalizePhone(phone),
      });
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

  const approveReviewMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const response = await apiRequest("POST", `/api/whatsapp/review-items/${candidateId}/approve`);
      return response.json();
    },
    onSuccess: async () => {
      await refreshWhatsAppData();
      toast({
        title: "Revisao concluida",
        description: "O lancamento automatico foi marcado como revisado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Nao foi possivel concluir a revisao",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const draft = draftByCandidate[candidateId];
      const response = await apiRequest("PATCH", `/api/whatsapp/review-items/${candidateId}/transaction`, {
        description: draft.description,
        amount: Number(draft.amount),
        category: draft.category,
        date: draft.date,
      });
      return response.json();
    },
    onSuccess: async () => {
      await refreshWhatsAppData();
      toast({
        title: "Lancamento atualizado",
        description: "As correcoes do WhatsApp foram salvas.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Nao foi possivel salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeReviewMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const response = await apiRequest("DELETE", `/api/whatsapp/review-items/${candidateId}/transaction`);
      return response.json();
    },
    onSuccess: async () => {
      await refreshWhatsAppData();
      toast({
        title: "Lancamento removido",
        description: "O item foi removido e continua rastreavel no historico do WhatsApp.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Nao foi possivel remover",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const ignoreSimilarMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const response = await apiRequest("POST", `/api/whatsapp/review-items/${candidateId}/ignore-similar`);
      return response.json();
    },
    onSuccess: async () => {
      await refreshWhatsAppData();
      toast({
        title: "Sugestoes parecidas serao evitadas",
        description: "O agente vai parar de automatizar lancamentos muito parecidos com este.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Nao foi possivel atualizar a regra",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const reviewItems = reviewItemsQuery.data || [];

  const filteredReviewItems = useMemo(
    () => reviewItems.filter((item) => {
      const confidence = item.confidenceScore ?? 0;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "auto_created" && item.status === "auto_created_pending_review")
        || (statusFilter === "needs_attention" && ["awaiting_user_confirmation", "awaiting_account_selection", "needs_clarification"].includes(item.status))
        || (statusFilter === "history" && ["reviewed_confirmed", "reviewed_corrected", "reviewed_removed", "confirmed", "ignored", "ignored_pattern"].includes(item.status));

      const matchesConfidence = confidenceFilter === "all"
        || (confidenceFilter === "high" && confidence >= 0.86)
        || (confidenceFilter === "medium" && confidence >= 0.7 && confidence < 0.86)
        || (confidenceFilter === "low" && confidence < 0.7);

      return matchesStatus && matchesConfidence;
    }),
    [confidenceFilter, reviewItems, statusFilter],
  );
  const autoCreatedItems = useMemo(
    () => filteredReviewItems.filter((item) => item.status === "auto_created_pending_review"),
    [filteredReviewItems],
  );

  const needsAttentionItems = useMemo(
    () => filteredReviewItems.filter((item) => ["awaiting_user_confirmation", "awaiting_account_selection", "needs_clarification"].includes(item.status)),
    [filteredReviewItems],
  );

  const historyItems = useMemo(
    () => filteredReviewItems.filter((item) => !autoCreatedItems.includes(item) && !needsAttentionItems.includes(item)),
    [filteredReviewItems, autoCreatedItems, needsAttentionItems],
  );

  const session = sessionQuery.data;
  const pendingConversationUrl = useMemo(() => {
    if (!session?.businessPhone || !session?.pendingBinding?.code) {
      return null;
    }

    return buildWhatsAppConversationUrl(
      session.businessPhone,
      session.pendingBinding.code,
      "client_pending_binding_conversation_link",
    );
  }, [session?.businessPhone, session?.pendingBinding?.code]);

  if (!hasWhatsAppAccess) {
    return (
      <>
        <div className="space-y-6 p-6">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-poppins">
                <MessageCircle className="h-5 w-5 text-primary" />
                Agent de WhatsApp disponível no Premium
              </CardTitle>
              <CardDescription>
                No Premium, o WhatsApp fica integrado ao FinScope para acelerar lançamentos, revisão de mensagens e automações.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border bg-background p-4 text-sm">Conectar um número e revisar lançamentos em uma fila dedicada.</div>
                <div className="rounded-xl border bg-background p-4 text-sm">Automação de mensagens com confirmação e histórico rastreável.</div>
                <div className="rounded-xl border bg-background p-4 text-sm">Fluxo pensado para acelerar o operacional sem perder controle.</div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => setIsUpgradeModalOpen(true)}>Ver Premium</Button>
                <Button variant="outline" onClick={() => window.location.href = "/settings"}>
                  Comparar planos
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <UpgradeModal
          open={isUpgradeModalOpen}
          onOpenChange={setIsUpgradeModalOpen}
          featureName="Agent de WhatsApp"
        />
      </>
    );
  }

  const getDraftForItem = (item: ReviewItem) => (
    draftByCandidate[item.candidateId] || {
      description: item.transaction?.description || item.description,
      amount: item.transaction?.amount || item.amount.toString(),
      category: item.transaction?.category || item.categorySuggestion || "",
      date: (item.transaction?.date || item.transactionDate).slice(0, 10),
    }
  );

  const updateDraftField = (candidateId: string, field: "description" | "amount" | "category" | "date", value: string) => {
    setDraftByCandidate((current) => ({
      ...current,
      [candidateId]: {
        ...(current[candidateId] || {}),
        [field]: value,
      },
    }));
  };

  const statusLabel = (status: string) => {
    if (status === "auto_created_pending_review") return "Criada automaticamente";
    if (status === "awaiting_user_confirmation") return "Precisa de confirmacao";
    if (status === "awaiting_account_selection") return "Precisa escolher conta";
    if (status === "needs_clarification") return "Precisa de detalhes";
    if (status === "reviewed_confirmed") return "Revisada";
    if (status === "reviewed_corrected") return "Corrigida";
    if (status === "reviewed_removed") return "Removida";
    if (status === "confirmed") return "Confirmada no chat";
    if (status === "ignored_pattern") return "Ignorar parecidas";
    if (status === "ignored") return "Ignorada";
    return status;
  };

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
                        {pendingConversationUrl ? (
                          <a
                            href={pendingConversationUrl}
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
                Lancamentos do WhatsApp
              </CardTitle>
              <CardDescription>Veja o que foi criado automaticamente, o que ainda precisa de voce e o historico de revisao.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border bg-slate-50 p-4 sm:flex-row">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="auto_created">Criadas automaticamente</SelectItem>
                      <SelectItem value="needs_attention">Precisa de revisao</SelectItem>
                      <SelectItem value="history">Historico e corrigidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Confianca</p>
                  <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="Todas as faixas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as faixas</SelectItem>
                      <SelectItem value="high">Alta confianca</SelectItem>
                      <SelectItem value="medium">Media confianca</SelectItem>
                      <SelectItem value="low">Baixa confianca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!session.eligible ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Este espaco fica liberado assim que sua assinatura estiver ativa.
                </div>
              ) : null}

              {session.eligible && !session.binding.isLinked ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Conecte seu numero para comecar a receber lancamentos e respostas no WhatsApp.
                </div>
              ) : null}

              {session.eligible && session.binding.isLinked && reviewItemsQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Carregando lancamentos do WhatsApp...
                </div>
              ) : null}

              {session.eligible && session.binding.isLinked && !filteredReviewItems.length && !reviewItemsQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhum lancamento encontrado com os filtros atuais.
                </div>
              ) : null}

              {autoCreatedItems.length ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Criadas automaticamente</p>
                  {autoCreatedItems.map((item) => {
                    const draft = getDraftForItem(item);
                    return (
                      <div key={item.candidateId} className="rounded-2xl border p-4">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{item.transaction?.description || item.description}</p>
                            <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                            <Badge variant="outline">{item.proposedType === "income" ? "Recebimento" : "Gasto"}</Badge>
                            <Badge variant="outline">Origem WhatsApp/IA</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(item.transaction?.date || item.transactionDate)} · {formatCurrency(Number(item.transaction?.amount || item.amount))}
                            {item.confidenceScore !== null ? ` · confianca ${Math.round(item.confidenceScore * 100)}%` : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">Conta usada: {item.evidence?.selectedAccountLabel || "Nao informada"}</p>
                          {item.inboundMessage?.textBody ? (
                            <p className="text-sm text-muted-foreground">Mensagem original: {item.inboundMessage.textBody}</p>
                          ) : null}
                          {item.mediaEvidence.length ? (
                            <p className="text-sm text-muted-foreground">
                              Midia associada: {item.mediaEvidence.length} arquivo(s)
                              {item.mediaEvidence[0]?.ocrText ? ` · OCR: ${item.mediaEvidence[0].ocrText.slice(0, 120)}` : ""}
                            </p>
                          ) : null}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input value={draft.description} onChange={(event) => updateDraftField(item.candidateId, "description", event.target.value)} />
                            <Input value={draft.category} onChange={(event) => updateDraftField(item.candidateId, "category", event.target.value)} placeholder="Categoria" />
                            <Input value={draft.amount} onChange={(event) => updateDraftField(item.candidateId, "amount", event.target.value)} placeholder="Valor" />
                            <Input type="date" value={draft.date} onChange={(event) => updateDraftField(item.candidateId, "date", event.target.value)} />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => approveReviewMutation.mutate(item.candidateId)} disabled={approveReviewMutation.isPending}>
                              Marcar como revisado
                            </Button>
                            <Button variant="outline" onClick={() => saveEditMutation.mutate(item.candidateId)} disabled={saveEditMutation.isPending}>
                              Salvar correcoes
                            </Button>
                            <Button variant="outline" onClick={() => removeReviewMutation.mutate(item.candidateId)} disabled={removeReviewMutation.isPending}>
                              Remover lancamento
                            </Button>
                            <Button variant="ghost" onClick={() => ignoreSimilarMutation.mutate(item.candidateId)} disabled={ignoreSimilarMutation.isPending}>
                              Ignorar parecidas
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {needsAttentionItems.length ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Precisa de revisao</p>
                  {needsAttentionItems.map((item) => (
                    <div key={item.candidateId} className="rounded-2xl border p-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.description}</p>
                          <Badge variant="secondary">{statusLabel(item.status)}</Badge>
                          <Badge variant="outline">Origem WhatsApp/IA</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(item.transactionDate)} · {formatCurrency(item.amount)}
                          {item.confidenceScore !== null ? ` · confianca ${Math.round(item.confidenceScore * 100)}%` : ""}
                        </p>
                        {item.inboundMessage?.textBody ? (
                          <p className="text-sm text-muted-foreground">Mensagem original: {item.inboundMessage.textBody}</p>
                        ) : null}
                        {item.status === "awaiting_account_selection" ? (
                          <Select
                            value={accountByCandidate[item.candidateId] || ""}
                            onValueChange={(value) => setAccountByCandidate((current) => ({ ...current, [item.candidateId]: value }))}
                          >
                            <SelectTrigger className="w-full sm:w-[240px]">
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
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => confirmMutation.mutate(item.candidateId)} disabled={confirmMutation.isPending}>
                            Confirmar
                          </Button>
                          <Button variant="outline" onClick={() => ignoreMutation.mutate(item.candidateId)} disabled={ignoreMutation.isPending}>
                            Ignorar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {historyItems.length ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-700">Historico e corrigidos</p>
                  {historyItems.slice(0, 8).map((item) => (
                    <div key={item.candidateId} className="rounded-2xl border p-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.transaction?.description || item.description}</p>
                          <Badge variant="outline">{statusLabel(item.status)}</Badge>
                          <Badge variant="outline">Origem WhatsApp/IA</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(item.transaction?.date || item.transactionDate)} · {formatCurrency(Number(item.transaction?.amount || item.amount))}
                        </p>
                        {item.inboundMessage?.textBody ? (
                          <p className="text-sm text-muted-foreground">Mensagem original: {item.inboundMessage.textBody}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
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
