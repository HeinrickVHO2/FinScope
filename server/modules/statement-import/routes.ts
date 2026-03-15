import type { Express } from "express";
import { z } from "zod";
import type { IStorage } from "../../storage";
import { StatementImportRepository } from "./repository";
import { StatementImportService } from "./service";

export type Middleware = (req: any, res: any, next: any) => void | Promise<void>;

const createUploadSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.enum(["csv", "ofx", "pdf"]),
  contentBase64: z.string().min(1),
  accountId: z.string().min(1),
  dateToleranceDays: z.number().int().min(0).max(10).optional(),
});

const updateEntryStatusSchema = z.object({
  status: z.enum(["ignored", "pending_review", "conflict"]),
  reason: z.string().max(400).optional(),
});

const confirmImportSchema = z.object({
  includePendingReview: z.boolean().optional(),
});

export function registerStatementImportRoutes(params: {
  app: Express;
  storage: IStorage;
  requireAuth: Middleware;
  requireActiveBilling: Middleware;
}) {
  const { app, storage, requireAuth, requireActiveBilling } = params;
  const repository = new StatementImportRepository();
  const service = new StatementImportService(repository, storage);

  app.post("/api/statement-imports/uploads", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const parsed = createUploadSchema.parse(req.body);
      const userId = req.session.userId as string;

      const result = await service.enqueueUploadJob({
        userId,
        accountId: parsed.accountId,
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        contentBase64: parsed.contentBase64,
        dateToleranceDays: parsed.dateToleranceDays,
      });

      return res.status(202).json({
        uploadId: result.uploadId,
        message: "Extrato recebido. Estamos analisando o arquivo.",
      });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Confira os dados informados antes de enviar o extrato."
        : error instanceof Error
          ? error.message
          : "Não foi possível receber esse arquivo.";
      return res.status(400).json({ error: message });
    }
  });

  app.get("/api/statement-imports/uploads", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const uploads = await service.listUploads(req.session.userId);
      return res.json(uploads);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar suas importações agora.",
      });
    }
  });

  app.get("/api/statement-imports/uploads/:uploadId", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const result = await service.getUploadDetails(req.session.userId, req.params.uploadId);
      if (!result) {
        return res.status(404).json({ error: "Upload não encontrado" });
      }

      return res.json(result);
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Não foi possível carregar os detalhes dessa importação.",
      });
    }
  });

  app.post(
    "/api/statement-imports/uploads/:uploadId/entries/:entryId/status",
    requireAuth,
    requireActiveBilling,
    async (req: any, res) => {
      try {
        const payload = updateEntryStatusSchema.parse(req.body);
        const updated = await service.updateEntryStatus({
          userId: req.session.userId,
          uploadId: req.params.uploadId,
          entryId: req.params.entryId,
          status: payload.status,
          reason: payload.reason,
        });

        return res.json(updated);
      } catch (error) {
        const message = error instanceof z.ZodError
          ? "Não foi possível atualizar esse item."
          : error instanceof Error
            ? error.message
            : "Não foi possível atualizar esse item.";
        return res.status(400).json({ error: message });
      }
    }
  );

  app.post("/api/statement-imports/uploads/:uploadId/confirm", requireAuth, requireActiveBilling, async (req: any, res) => {
    try {
      const payload = confirmImportSchema.parse(req.body || {});
      const result = await service.confirmImport({
        userId: req.session.userId,
        uploadId: req.params.uploadId,
        includePendingReview: payload.includePendingReview,
      });

      return res.json({
        importedCount: result.importedCount,
        message: "Importação concluída com sucesso.",
      });
    } catch (error) {
      const message = error instanceof z.ZodError
        ? "Não foi possível concluir a importação."
        : error instanceof Error
          ? error.message
          : "Não foi possível concluir a importação.";
      return res.status(400).json({ error: message });
    }
  });
}

