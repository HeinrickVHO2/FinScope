import { WHATSAPP_ALLOWED_MEDIA_MIME_TYPES, WHATSAPP_MAX_MEDIA_BYTES } from "./decision";
import { getWhatsAppMetaConfig } from "./config";
import type { WhatsAppInboundMedia } from "./types";

const ALLOWED_HOSTS = [
  "graph.facebook.com",
  "lookaside.fbsbx.com",
  "mmg.whatsapp.net",
];

function isAllowedHost(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function toBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

function guessTextFromBinary(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const printable = text.replace(/[^\x20-\x7EÀ-ÿ\r\n\t]/g, "");
  if (!printable.trim()) {
    return "";
  }

  return printable.slice(0, 6000);
}

export interface PreparedMediaPayload {
  mimeType?: string;
  base64?: string;
  storagePath: string;
  fileSizeBytes: number;
  textHint?: string;
}

export class WhatsAppMediaService {
  async prepareMedia(media: WhatsAppInboundMedia): Promise<PreparedMediaPayload | null> {
    const mimeType = media.mimeType || undefined;
    if (mimeType && !WHATSAPP_ALLOWED_MEDIA_MIME_TYPES.has(mimeType)) {
      console.warn("[WHATSAPP MEDIA] blocked unsupported mime type", { mimeType, mediaId: media.id });
      return null;
    }

    if (media.base64) {
      const buffer = Buffer.from(media.base64, "base64");
      if (buffer.byteLength > WHATSAPP_MAX_MEDIA_BYTES) {
        console.warn("[WHATSAPP MEDIA] blocked oversized base64 media", { mediaId: media.id, size: buffer.byteLength });
        return null;
      }

      return {
        mimeType,
        base64: media.base64,
        storagePath: media.fileName || `inline://${media.id}`,
        fileSizeBytes: buffer.byteLength,
        textHint: guessTextFromBinary(buffer),
      };
    }

    if (media.url && isAllowedHost(media.url)) {
      const response = await fetch(media.url, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Falha ao baixar mídia do host permitido (${response.status})`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > WHATSAPP_MAX_MEDIA_BYTES) {
        console.warn("[WHATSAPP MEDIA] blocked oversized allowed-host media", { mediaId: media.id, size: buffer.byteLength });
        return null;
      }

      return {
        mimeType: mimeType || response.headers.get("content-type") || undefined,
        base64: buffer.toString("base64"),
        storagePath: media.url,
        fileSizeBytes: buffer.byteLength,
        textHint: guessTextFromBinary(buffer),
      };
    }

    return this.downloadFromMeta(media);
  }

  private async downloadFromMeta(media: WhatsAppInboundMedia): Promise<PreparedMediaPayload | null> {
    const config = getWhatsAppMetaConfig();
    if (!config.accessToken || !media.id) {
      return {
        mimeType: media.mimeType,
        storagePath: `meta://whatsapp/${media.id}`,
        fileSizeBytes: 0,
      };
    }

    const metadataResponse = await fetch(`https://graph.facebook.com/v22.0/${media.id}`, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!metadataResponse.ok) {
      throw new Error(`Falha ao consultar metadata da mídia (${metadataResponse.status})`);
    }

    const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number };
    if (!metadata.url || !isAllowedHost(metadata.url)) {
      throw new Error("URL da mídia rejeitada por segurança");
    }

    if (metadata.file_size && metadata.file_size > WHATSAPP_MAX_MEDIA_BYTES) {
      console.warn("[WHATSAPP MEDIA] blocked oversized Meta media", { mediaId: media.id, size: metadata.file_size });
      return null;
    }

    const contentResponse = await fetch(metadata.url, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!contentResponse.ok) {
      throw new Error(`Falha ao baixar mídia da Meta (${contentResponse.status})`);
    }

    const contentType = metadata.mime_type || contentResponse.headers.get("content-type") || media.mimeType || undefined;
    if (contentType && !WHATSAPP_ALLOWED_MEDIA_MIME_TYPES.has(contentType)) {
      console.warn("[WHATSAPP MEDIA] blocked unsupported Meta mime type", { mediaId: media.id, contentType });
      return null;
    }

    const buffer = Buffer.from(await contentResponse.arrayBuffer());
    if (buffer.byteLength > WHATSAPP_MAX_MEDIA_BYTES) {
      console.warn("[WHATSAPP MEDIA] blocked oversized Meta content", { mediaId: media.id, size: buffer.byteLength });
      return null;
    }

    return {
      mimeType: contentType,
      base64: toBase64(buffer),
      storagePath: metadata.url,
      fileSizeBytes: buffer.byteLength,
      textHint: guessTextFromBinary(buffer),
    };
  }
}
