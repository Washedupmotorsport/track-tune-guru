// Upload validation shared by every photo upload path.
//
// The `accept` attribute on a file input is only a browser hint, and the
// content type sent to storage comes straight from the file object, so both are
// attacker-controlled. These checks bound what the app itself will send.
// The authoritative limits belong on the storage bucket itself
// (allowed_mime_types + file_size_limit); keep the two in step.

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

/**
 * Throws a user-facing Error when the file is not an allowed image or is too
 * large. Returns the safe content type and a safe extension derived from that
 * type, so neither value is taken from the (untrusted) file name.
 */
export function assertValidImageUpload(file: File): {
  contentType: string;
  ext: string;
} {
  const type = (file.type || "").toLowerCase();

  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)) {
    throw new Error(
      `"${file.name}" is not a supported image. Use JPEG, PNG, WebP, GIF or HEIC.`,
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`"${file.name}" is larger than ${mb} MB.`);
  }

  if (file.size === 0) {
    throw new Error(`"${file.name}" is empty.`);
  }

  return { contentType: type, ext: EXT_BY_TYPE[type] ?? "img" };
}

/** Comma-separated list for an <input type="file"> accept attribute. */
export const IMAGE_ACCEPT_ATTR = ALLOWED_IMAGE_TYPES.join(",");
