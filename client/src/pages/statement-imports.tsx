import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Account } from "@shared/schema";
import { UploadCloud, RefreshCcw, CheckCircle2, AlertTriangle, FileWarning, ShieldCheck } from "lucide-react";

type UploadSummary = {
  totalFound: number;
  newItems: number;
  reconciled: number;
  duplicated: number;
  conflicts: number;
};

type UploadItem = {
  id: string;
  fileName: string;
  fileType: "pdf" | "csv" | "ofx";
  processingStatus: "queued" | "processing" | "completed" | "failed";
  uploadStatus: "received" | "validated" | "rejected";
  summary: UploadSummary | null;
  errorMessage: string | null;
  createdAt: string;
};

type UploadEntry = {
  id: string;
  lineNumber: number;
  transactionDate: string;
  originalDescription: string;
  amount: number;
  direction: "credit" | "debit";
  reconciliationStatus: "pending_review" | "matched" | "imported" | "duplicate" | "conflict" | "ignored";
  matchedTransactionId: string | null;
  confidenceScore: number | null;
  reconciliationReason: string | null;
};

type UploadDetails = {
  upload: UploadItem;
  summary: UploadSummary;
  entries: UploadEntry[];
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function statusBadge(status: UploadEntry["reconciliationStatus"]) {
  const map: Record<UploadEntry["reconciliationStatus"], { label: string; className: string }> = {
    pending_review: { label: "Para revisar", className: "bg-amber-100 text-amber-800" },
    matched: { label: "Já existe", className: "bg-emerald-100 text-emerald-800" },
    imported: { label: "Importado", className: "bg-sky-100 text-sky-800" },
    duplicate: { label: "Repetido", className: "bg-violet-100 text-violet-800" },
    conflict: { label: "Pendência", className: "bg-rose-100 text-rose-800" },
    ignored: { label: "Ignorado", className: "bg-slate-200 text-slate-700" },
  };

  return map[status];
}

function processingStatusBadge(status: UploadItem["processingStatus"]) {
  const map: Record<UploadItem["processingStatus"], { label: string; className: string }> = {
    queued: { label: "Na fila", className: "bg-slate-100 text-slate-700" },
    processing: { label: "Em análise", className: "bg-amber-100 text-amber-800" },
    completed: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
    failed: { label: "Não concluído", className: "bg-rose-100 text-rose-800" },
  };

  return map[status];
}

function importedCountText(count: number) {
  return count === 1 ? "1 movimentação foi adicionada." : `${count} movimentações foram adicionadas.`;
}

export default function StatementImportsPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<string>("");
  const [fileType, setFileType] = useState<"pdf" | "csv" | "ofx">("csv");
  const [dateToleranceDays, setDateToleranceDays] = useState<number>(3);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: uploads = [], isLoading: uploadsLoading } = useQuery<UploadItem[]>({
    queryKey: ["/api/statement-imports/uploads"],
  });

  const selectedUpload = useMemo(
    () => uploads.find((item) => item.id === selectedUploadId) || uploads[0],
    [selectedUploadId, uploads]
  );

  const { data: details, isLoading: detailsLoading, refetch: refetchDetails } = useQuery<UploadDetails>({
    queryKey: [selectedUpload ? `/api/statement-imports/uploads/${selectedUpload.id}` : null],
    enabled: Boolean(selectedUpload?.id),
    refetchInterval: selectedUpload?.processingStatus === "processing" || selectedUpload?.processingStatus === "queued" ? 2500 : false,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione um arquivo");
      if (!accountId) throw new Error("Selecione a conta de destino");

      const contentBase64 = await fileToBase64(file);
      const response = await apiRequest("POST", "/api/statement-imports/uploads", {
        fileName: file.name,
        fileType,
        contentBase64,
        accountId,
        dateToleranceDays,
      });

      return response.json();
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/statement-imports/uploads"] });
      setSelectedUploadId(result.uploadId);
      setFile(null);
      toast({
        title: "Extrato recebido",
        description: "Estamos analisando o arquivo em segundo plano.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível importar o arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEntryStatusMutation = useMutation({
    mutationFn: async (payload: { entryId: string; status: "ignored" | "pending_review" | "conflict" }) => {
      if (!selectedUpload?.id) throw new Error("Nenhum upload selecionado");
      await apiRequest("POST", `/api/statement-imports/uploads/${selectedUpload.id}/entries/${payload.entryId}/status`, {
        status: payload.status,
      });
    },
    onSuccess: async () => {
      if (!selectedUpload?.id) return;
      await queryClient.invalidateQueries({ queryKey: [`/api/statement-imports/uploads/${selectedUpload.id}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível atualizar este item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUpload?.id) throw new Error("Nenhum upload selecionado");
      const response = await apiRequest("POST", `/api/statement-imports/uploads/${selectedUpload.id}/confirm`, {});
      return response.json();
    },
    onSuccess: async (result: { importedCount: number }) => {
      if (!selectedUpload?.id) return;
      await queryClient.invalidateQueries({ queryKey: ["/api/statement-imports/uploads"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/statement-imports/uploads/${selectedUpload.id}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=ALL"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PF"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/transactions?type=PJ"] });

      toast({
        title: "Importação concluída",
        description: importedCountText(result.importedCount),
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Não foi possível concluir a importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onRefreshDetails = async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/statement-imports/uploads"] });
    await refetchDetails();
  };

  const selectedSummary = details?.summary;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-poppins font-bold">Importação de extratos</h1>
        <p className="text-muted-foreground">
          Envie seu extrato em PDF, CSV ou OFX para conferir as movimentações da conta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UploadCloud className="h-5 w-5" />
            Importar extrato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formato</Label>
              <Select value={fileType} onValueChange={(value: "pdf" | "csv" | "ofx") => setFileType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="ofx">OFX</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diferença permitida na data (dias)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={dateToleranceDays}
                onChange={(event) => setDateToleranceDays(Number(event.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input
                type="file"
                accept=".csv,.ofx,.pdf"
                onChange={(event) => {
                  const selected = event.target.files?.[0] || null;
                  setFile(selected);
                  if (selected) {
                    const extension = selected.name.split(".").pop()?.toLowerCase();
                    if (extension === "csv" || extension === "ofx" || extension === "pdf") {
                      setFileType(extension);
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Enviando..." : "Importar extrato"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Tamanho máximo: 8 MB. Arquivos suspeitos podem ser bloqueados por segurança.
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Importações recentes</CardTitle>
            <Button variant="ghost" size="icon" onClick={onRefreshDetails}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {uploadsLoading ? <p className="text-sm text-muted-foreground">Carregando importações...</p> : null}
            {!uploadsLoading && uploads.length === 0 ? (
              <p className="text-sm text-muted-foreground">Você ainda não importou nenhum extrato.</p>
            ) : null}

            {uploads.map((item) => {
              const active = selectedUpload?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedUploadId(item.id)}
                  className={`w-full rounded-lg border p-3 text-left ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{item.fileName}</p>
                    <Badge variant="outline">{item.fileType.toUpperCase()}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                  <div className="mt-2">
                    <Badge className={processingStatusBadge(item.processingStatus).className}>
                      {processingStatusBadge(item.processingStatus).label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Resumo da importação</CardTitle>
            {selectedUpload ? (
              <Badge className={processingStatusBadge(selectedUpload.processingStatus).className}>
                {processingStatusBadge(selectedUpload.processingStatus).label}
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedUpload ? (
              <p className="text-sm text-muted-foreground">Escolha uma importação para ver os detalhes.</p>
            ) : null}

            {selectedUpload?.processingStatus === "failed" ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">
                Não conseguimos concluir essa importação. {selectedUpload.errorMessage || "Tente novamente com outro arquivo."}
              </div>
            ) : null}

            {detailsLoading ? <p className="text-sm text-muted-foreground">Carregando detalhes...</p> : null}

            {selectedSummary ? (
              <div className="grid gap-3 md:grid-cols-5">
                <Card className="border-dashed">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total encontrado</p>
                    <p className="text-lg font-semibold">{selectedSummary.totalFound}</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Novas movimentações</p>
                    <p className="text-lg font-semibold">{selectedSummary.newItems}</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Já existentes</p>
                    <p className="text-lg font-semibold">{selectedSummary.reconciled}</p>
                  </CardContent>
                </Card>
                <Card className="border-violet-200 bg-violet-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Repetidos</p>
                    <p className="text-lg font-semibold">{selectedSummary.duplicated}</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-200 bg-rose-50">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Pendências</p>
                    <p className="text-lg font-semibold">{selectedSummary.conflicts}</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {details?.entries?.length ? (
              <div className="space-y-2">
                <div className="max-h-[420px] overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-right">Valor</th>
                        <th className="p-2 text-left">Situação</th>
                        <th className="p-2 text-left">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.entries.map((entry) => {
                        const badge = statusBadge(entry.reconciliationStatus);
                        return (
                          <tr key={entry.id} className="border-t">
                            <td className="p-2">{new Date(entry.transactionDate).toLocaleDateString("pt-BR")}</td>
                            <td className="p-2">
                              <div className="font-medium">{entry.originalDescription}</div>
                              {entry.reconciliationReason ? (
                                <div className="text-xs text-muted-foreground">{entry.reconciliationReason}</div>
                              ) : null}
                            </td>
                            <td className="p-2 text-right font-medium">
                              {entry.direction === "debit" ? "-" : "+"}R$ {Number(entry.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2">
                              <Badge className={badge.className}>{badge.label}</Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {(entry.reconciliationStatus === "pending_review" || entry.reconciliationStatus === "conflict") ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateEntryStatusMutation.mutate({ entryId: entry.id, status: "ignored" })}
                                  >
                                    Ignorar
                                  </Button>
                                ) : null}
                                {entry.reconciliationStatus === "ignored" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => updateEntryStatusMutation.mutate({ entryId: entry.id, status: "pending_review" })}
                                  >
                                    Revisar novamente
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  <ShieldCheck className="mt-0.5 h-4 w-4" />
                  <span>
                    Itens já existentes, repetidos ou com pendência não entram automaticamente. Apenas as movimentações marcadas para revisão final são importadas.
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending || selectedUpload.processingStatus !== "completed"}
                  >
                    {confirmMutation.isPending ? "Concluindo..." : "Concluir importação"}
                  </Button>
                  <Button variant="outline" onClick={onRefreshDetails}>
                    Recarregar
                  </Button>
                </div>
              </div>
            ) : null}

            {!details?.entries?.length && selectedUpload?.processingStatus === "completed" ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                Nenhuma movimentação foi encontrada nesse arquivo.
              </div>
            ) : null}

            {selectedUpload?.processingStatus === "queued" || selectedUpload?.processingStatus === "processing" ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                  Estamos lendo seu arquivo. Esta tela se atualiza automaticamente.
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <CheckCircle2 className="mb-1 h-4 w-4 text-emerald-600" />
                <strong>Já existe</strong>
                <p>Encontramos uma movimentação parecida que já está cadastrada.</p>
              </div>
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <FileWarning className="mb-1 h-4 w-4 text-violet-600" />
                <strong>Repetido</strong>
                <p>Há sinais de que essa movimentação já apareceu antes.</p>
              </div>
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <AlertTriangle className="mb-1 h-4 w-4 text-rose-600" />
                <strong>Pendência</strong>
                <p>Encontramos diferença importante de valor ou data. Vale revisar.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


