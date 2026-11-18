"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API || "http://localhost:3030";
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;
const TARGET_DIMENSION = 512;

type Status = "idle" | "validating" | "uploading" | "saving" | "success" | "error";

interface AvatarUploaderProps {
  avatarUrl?: string | null;
  name?: string | null;
  email?: string | null;
  onChange?: (avatarUrl: string | null) => void;
  disabled?: boolean;
}

interface PreparedImage {
  blob: Blob;
  contentType: string;
}

export function AvatarUploader({
  avatarUrl,
  name,
  email,
  onChange,
  disabled = false,
}: AvatarUploaderProps) {
  const token = useAuthStore((state) => state.token);
  const refreshUserData = useAuthStore((state) => state.refreshUserData);

  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl ?? null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(avatarUrl ?? null);
  }, [avatarUrl]);

  const busy =
    status === "validating" ||
    status === "uploading" ||
    status === "saving";
  const blocked = disabled || busy;

  const chooseFile = useCallback(() => {
    if (blocked) return;
    inputRef.current?.click();
  }, [blocked]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file || blocked) return;

      setError(null);
      setStatus("validating");

      try {
        const prepared = await prepareImage(file);
        setStatus("uploading");
        setProgress(0);
        const savedUrl = await uploadAvatar(
          prepared,
          token,
          setProgress,
          () => setStatus("saving"),
        );
        setPreview(savedUrl);
        onChange?.(savedUrl);
        setStatus("success");
        toast.success("Profile picture updated");
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "Failed to upload profile picture";
        setError(message);
        setStatus("error");
        toast.error(message);
      } finally {
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [blocked, onChange, token],
  );

  const remove = useCallback(async () => {
    if (blocked) return;
    const previous = preview;
    // Optimistic UI: initials return immediately.
    setPreview(null);
    onChange?.(null);
    setError(null);
    setStatus("saving");

    try {
      const response = await fetch(`${API_BASE}/profile/avatar`, {
        method: "DELETE",
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });
      if (!response.ok) throw new Error("Failed to remove profile picture");
      await refreshUserData();
      setStatus("idle");
      toast.success("Profile picture removed");
    } catch (removeError) {
      setPreview(previous);
      onChange?.(previous);
      setStatus("error");
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove profile picture";
      setError(message);
      toast.error(message);
    }
  }, [blocked, onChange, preview, refreshUserData, token]);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        data-testid="avatar-file-input"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div className="flex items-center gap-4">
        <div className="relative">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={name ? `${name}'s profile picture` : "Profile picture"}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-xl font-semibold">
              {initials(name, email)}
            </div>
          )}
          {busy ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={chooseFile}
              disabled={blocked}
              aria-label="Upload profile picture"
            >
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
              {preview ? "Replace image" : "Upload image"}
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void remove()}
                disabled={blocked}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Remove image
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG or WebP. At least 64×64px, up to 5 MB. Images are
            resized to 512px before upload.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={chooseFile}
        onDragOver={(event) => {
          event.preventDefault();
          if (!blocked) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        disabled={blocked}
        aria-label="Upload profile picture by dropping a file here"
        className={cn(
          "flex min-h-16 w-full items-center justify-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors",
          dragging ? "border-primary bg-primary/5 text-foreground" : "border-border",
          blocked && "cursor-not-allowed opacity-60",
        )}
      >
        <UploadCloud className="h-4 w-4" aria-hidden="true" />
        {dragging ? "Drop the image to upload" : "Drag and drop an image here"}
      </button>

      {status === "uploading" ? (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <progress
            className="h-2 w-full overflow-hidden rounded"
            value={progress}
            max={100}
            aria-label="Upload progress"
          />
          <span className="w-10 text-right">{progress}%</span>
        </div>
      ) : null}

      <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
        {status === "validating" && "Checking the image…"}
        {status === "uploading" && "Uploading the image…"}
        {status === "saving" && "Saving your new picture…"}
        {status === "success" && "Profile picture updated."}
      </p>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("Choose a PNG, JPEG or WebP image");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Images must be smaller than 5 MB");
  }

  const image = await loadImage(file);
  if (
    image.width < MIN_DIMENSION ||
    image.height < MIN_DIMENSION ||
    image.width > MAX_DIMENSION ||
    image.height > MAX_DIMENSION
  ) {
    throw new Error("Images must be between 64×64 and 4096×4096 pixels");
  }

  const scale = Math.min(
    1,
    TARGET_DIMENSION / Math.max(image.width, image.height),
  );
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the image");
  context.drawImage(image, 0, 0, width, height);

  const requestedType = supportsWebp()
    ? "image/webp"
    : file.type === "image/png"
      ? "image/png"
      : "image/jpeg";
  const blob = await canvasToBlob(canvas, requestedType);
  return { blob, contentType: requestedType };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a readable image"));
    };
    image.src = url;
  });
}

function supportsWebp(): boolean {
  try {
    return document
      .createElement("canvas")
      .toDataURL("image/webp")
      .startsWith("data:image/webp");
  } catch {
    return false;
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  contentType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not prepare the image")),
      contentType,
      0.9,
    );
  });
}

async function uploadAvatar(
  prepared: PreparedImage,
  token: string | null,
  onProgress: (value: number) => void,
  onSaving: () => void,
): Promise<string> {
  const presignResponse = await fetch(`${API_BASE}/storage/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({
      purpose: "avatar",
      contentType: prepared.contentType,
      size: prepared.blob.size,
    }),
  });

  const presign = await presignResponse.json().catch(() => ({}));
  if (!presignResponse.ok) {
    throw new Error(presign?.message || "Could not start the upload");
  }

  await putWithProgress(
    presign.uploadUrl,
    prepared.blob,
    presign.headers ?? {},
    onProgress,
  );

  onSaving();
  const finalizeResponse = await fetch(`${API_BASE}/profile/avatar`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    },
    body: JSON.stringify({ key: presign.key }),
  });
  const finalized = await finalizeResponse.json().catch(() => ({}));
  if (!finalizeResponse.ok) {
    throw new Error(finalized?.message || "Could not save the picture");
  }

  // The parent controls the visible avatar; this refreshes the header/sidebar
  // cache as well.
  await useAuthStore.getState().refreshUserData();

  return typeof finalized.avatarUrl === "string" ? finalized.avatarUrl : presign.publicUrl;
}

function putWithProgress(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  onProgress: (value: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error("Upload failed. Please try again."));
      }
    };
    request.onerror = () => reject(new Error("Upload failed. Please try again."));
    request.send(blob);
  });
}

export default AvatarUploader;
