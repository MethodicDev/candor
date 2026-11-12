import * as React from "react"
import { File, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, Music, Paperclip, Video, X, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useFormat, useStrings, type Formatter, type Translate } from "@/components/candor/locale"
import type { Attachment } from "@/lib/candor/chat"
import { neutralizeBidi } from "@/lib/candor/bidi"
import { motion } from "@/lib/candor/motion"

/** The upload bar moving between measured byte counts: 2.2's 300 ms. */
const progressMotion = motion("attachment-preview", "progress", "fill", { dur: 300 })

/** AttachmentPreview's fixed words; override them under `attachmentPreview` in LocaleProvider's `strings`. */
export const attachmentPreviewStrings = {
  remove: "Remove {name}",
  open: "Open {name}",
  attachments: { one: "{count} attachment", other: "{count} attachments" },
  /** File sizes; `{size}` is already formatted. */
  bytes: "{size} B",
  kilobytes: "{size} KB",
  megabytes: "{size} MB",
}

/** "820 B", "14 KB", "2.4 MB", in the locale. */
export function formatFileSize(bytes: number | undefined, number: Formatter["number"], t: Translate<typeof attachmentPreviewStrings>): string | null {
  if (bytes === undefined) return null
  if (bytes < 1024) return t("bytes", { size: number(bytes, { useGrouping: false }) })
  if (bytes < 1024 * 1024) return t("kilobytes", { size: number(Math.round(bytes / 1024), { useGrouping: false }) })
  return t("megabytes", { size: number(bytes / 1024 / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }) })
}

/** An icon for a file, from its media type or, failing that, its extension. */
export function fileIcon(a: Pick<Attachment, "name" | "mediaType">): LucideIcon {
  const type = a.mediaType ?? ""
  const ext = a.name.split(".").pop()?.toLowerCase() ?? ""
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(ext)) return FileImage
  if (type.startsWith("audio/")) return Music
  if (type.startsWith("video/")) return Video
  if (/csv|spreadsheet|excel/.test(type) || ["csv", "xls", "xlsx", "tsv"].includes(ext)) return FileSpreadsheet
  if (/zip|tar|gzip|compressed/.test(type) || ["zip", "tar", "gz", "tgz", "7z"].includes(ext)) return FileArchive
  if (/json|javascript|typescript|xml|x-sh|x-python/.test(type) || ["json", "js", "ts", "tsx", "py", "sql", "sh", "yaml", "yml", "xml"].includes(ext)) return FileCode
  if (type.startsWith("text/") || type === "application/pdf" || ["txt", "md", "pdf", "doc", "docx", "rtf"].includes(ext)) return FileText
  return File
}

/** The icon for a file's type. */
function FileGlyph({ attachment }: { attachment: Pick<Attachment, "name" | "mediaType"> }) {
  return React.createElement(fileIcon(attachment), { className: "size-4" })
}

/** A thumbnail only for images whose preview the app supplied. */
const thumbnail = (a: Attachment) => (a.previewUrl && (a.mediaType ?? "").startsWith("image/") ? a.previewUrl : undefined)

/**
 * A file waiting to be sent, as a chip in the composer: its name, then upload progress, an error, or its size, and a
 * remove button. Images show their preview when the app gives one.
 *
 * @motion fill:progress The upload bar under the chip moves from the old reported fraction to the new one as the service
 * reports it. It is drawn at its first value in place, never grown from empty, and a file with no progress draws no bar.
 */
function AttachmentChip({
  attachment: a,
  onRemove,
  className,
  style,
}: {
  /** The file, with progress (0–1) while uploading or an error if it failed. */
  attachment: Attachment
  /** Shows a remove button. */
  onRemove?: ((id: string) => void) | undefined
  className?: string | undefined
  /** Inline style for the chip's outer element, such as a motion chain from `motion()`. */
  style?: React.CSSProperties | undefined
}) {
  const t = useStrings("attachmentPreview", attachmentPreviewStrings)
  const fmt = useFormat()
  const thumb = thumbnail(a)
  // A file's name can come from a model or a tool: no bidi control reorders it.
  const name = neutralizeBidi(a.name)
  return (
    <span
      data-slot="attachment-chip"
      style={style}
      className={cn("relative inline-flex max-w-56 items-center gap-1.5 overflow-hidden rounded-md border bg-card py-1 pe-1 ps-2 text-xs", a.error && "border-destructive/50", className)}
    >
      {thumb ? <img src={thumb} alt="" className="size-4 shrink-0 rounded-xs object-cover" /> : <Paperclip aria-hidden className="size-3 shrink-0 text-muted-foreground" />}
      <bdi className="truncate">{name}</bdi>
      <span className={cn("shrink-0 tabular-nums", a.error ? "text-destructive-text" : "text-faint-foreground")}>
        {a.error ? a.error : a.progress !== undefined ? fmt.number(Math.round(a.progress * 100) / 100, { style: "percent" }) : formatFileSize(a.size, fmt.number, t)}
      </span>
      {onRemove && (
        <button type="button" aria-label={t("remove", { name })} onClick={() => onRemove(a.id)} className="relative after:absolute after:-inset-1 rounded-sm p-0.5 text-faint-foreground hover:bg-accent hover:text-foreground">
          <X className="size-3" />
        </button>
      )}
      {a.progress !== undefined && !a.error && <span aria-hidden className="absolute bottom-0 start-0 h-0.5 bg-primary cd-fill" style={{ ...progressMotion, width: `${a.progress * 100}%` }} />}
    </span>
  )
}

/**
 * A sent file, as a tile in a message: an image preview when the app supplied one, else an icon for its type, with
 * its name and size. The name is never a link: with `onOpen` the tile is a button and your app decides what opening
 * means (a viewer, a signed download).
 */
function AttachmentPreview({
  attachment: a,
  onOpen,
  className,
}: {
  /** The file. `previewUrl` must be one your app serves (a thumbnail, a blob: URL); it's shown only for images. */
  attachment: Attachment
  /** Makes the tile a button that opens the file. */
  onOpen?: ((attachment: Attachment) => void) | undefined
  className?: string | undefined
}) {
  const t = useStrings("attachmentPreview", attachmentPreviewStrings)
  const fmt = useFormat()
  const thumb = thumbnail(a)
  const size = formatFileSize(a.size, fmt.number, t)
  const name = neutralizeBidi(a.name)
  const body = (
    <>
      {thumb ? (
        <img src={thumb} alt="" className="h-24 w-full rounded-md bg-muted object-cover" />
      ) : (
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileGlyph attachment={a} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <bdi className="block truncate text-sm">{name}</bdi>
        {(size || a.error) && <span className={cn("block text-xs tabular-nums", a.error ? "text-destructive-text" : "text-faint-foreground")}>{a.error ?? size}</span>}
      </span>
    </>
  )
  const frame = cn("flex w-56 max-w-full gap-2.5 rounded-lg border bg-card p-2 text-start", thumb ? "flex-col" : "items-center", className)
  return onOpen ? (
    <button
      type="button"
      data-slot="attachment-preview"
      aria-label={t("open", { name })}
      onClick={() => onOpen(a)}
      className={cn(frame, "outline-none cd-tint hover:border-border-strong focus-visible:ring-[3px] focus-visible:ring-ring/80")}
    >
      {body}
    </button>
  ) : (
    <div data-slot="attachment-preview" className={frame}>
      {body}
    </div>
  )
}

/** Several sent files, as a wrapping row of tiles, announced as a list. */
function AttachmentList({
  attachments,
  onOpen,
  className,
}: {
  /** The files. */
  attachments: Attachment[]
  /** Makes each tile a button that opens its file. */
  onOpen?: ((attachment: Attachment) => void) | undefined
  className?: string | undefined
}) {
  const t = useStrings("attachmentPreview", attachmentPreviewStrings)
  return (
    <ul data-slot="attachment-list" aria-label={t("attachments", { count: attachments.length })} className={cn("flex flex-wrap gap-2", className)}>
      {attachments.map((a) => (
        <li key={a.id} className="max-w-full">
          <AttachmentPreview attachment={a} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

export { AttachmentChip, AttachmentPreview, AttachmentList }
