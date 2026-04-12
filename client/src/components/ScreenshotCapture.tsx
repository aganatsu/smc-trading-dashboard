/**
 * ScreenshotCapture — Allows users to capture/upload chart screenshots
 * and attach them to trade journal entries.
 * Design: Obsidian Forge — Dark Brutalist Trading Interface
 */

import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface ScreenshotCaptureProps {
  tradeId?: number;
  currentUrl?: string | null;
  onScreenshotUploaded: (url: string) => void;
}

export default function ScreenshotCapture({
  tradeId,
  currentUrl,
  onScreenshotUploaded,
}: ScreenshotCaptureProps) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.trades.uploadScreenshot.useMutation({
    onSuccess: (data) => {
      setPreview(data.url);
      onScreenshotUploaded(data.url);
      toast.success("Screenshot attached");
      setUploading(false);
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err.message}`);
      setUploading(false);
    },
  });

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }

      setUploading(true);

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        // Show preview immediately
        setPreview(result);

        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64Data = result.split(",")[1];
        if (!base64Data) {
          toast.error("Failed to process image");
          setUploading(false);
          return;
        }

        uploadMutation.mutate({
          imageData: base64Data,
          tradeId: tradeId,
        });
      };
      reader.readAsDataURL(file);
    },
    [tradeId, uploadMutation]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            return;
          }
        }
      }
    },
    [processFile]
  );

  const clearScreenshot = () => {
    setPreview(null);
    onScreenshotUploaded("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
        Chart Screenshot
      </label>

      {preview ? (
        <div className="relative border-2 border-border bg-muted/30 group">
          <img
            src={preview}
            alt="Trade screenshot"
            className="w-full h-40 object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-card border border-border text-xs font-mono text-foreground hover:text-cyan transition-colors"
            >
              Replace
            </button>
            <button
              onClick={clearScreenshot}
              className="px-3 py-1.5 bg-card border border-border text-xs font-mono text-bearish hover:bg-bearish/10 transition-colors"
            >
              Remove
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-cyan animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`border-2 border-dashed ${
            dragOver ? "border-cyan bg-cyan/5" : "border-border"
          } bg-muted/10 p-4 text-center cursor-pointer transition-colors hover:border-cyan/50`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onPaste={handlePaste}
          tabIndex={0}
        >
          {uploading ? (
            <div className="py-2">
              <Loader2 className="w-5 h-5 text-cyan animate-spin mx-auto mb-2" />
              <p className="text-[10px] font-mono text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-3 mb-2">
                <Camera className="w-4 h-4 text-muted-foreground" />
                <Upload className="w-4 h-4 text-muted-foreground" />
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Click to upload, drag & drop, or paste (Ctrl+V)
              </p>
              <p className="text-[8px] font-mono text-muted-foreground/60 mt-1">
                PNG, JPG up to 5MB
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
