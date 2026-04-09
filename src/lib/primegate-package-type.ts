const ARCHIVE_EXTENSIONS = [
  ".zip",
  ".tar",
  ".tgz",
  ".tar.gz",
  ".7z",
  ".rar",
] as const;

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
] as const;

const DATASET_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".jsonl",
  ".parquet",
  ".arrow",
  ".feather",
  ".ndjson",
  ".xlsx",
  ".xls",
] as const;

const PROMPT_EXTENSIONS = [
  ".prompt",
  ".md",
  ".mdx",
  ".prompt.json",
] as const;

const DOCUMENT_EXTENSIONS = [
  ".txt",
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
] as const;

const SOURCE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".rs",
  ".go",
  ".sol",
  ".move",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".sh",
  ".yaml",
  ".yml",
  ".toml",
  ".json",
  ".lock",
] as const;

export type PrimeGatePackageType =
  | "archive"
  | "dataset"
  | "document"
  | "image"
  | "prompt"
  | "source"
  | "binary";

function matchesExtension(fileName: string, extensions: readonly string[]) {
  return extensions.some((extension) => fileName.endsWith(extension));
}

export function inferPrimeGatePackageType(fileName: string, mimeType: string): PrimeGatePackageType {
  const normalizedFileName = fileName.trim().toLowerCase();
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (
    normalizedMimeType.includes("zip") ||
    normalizedMimeType.includes("gzip") ||
    normalizedMimeType.includes("x-tar") ||
    normalizedMimeType.includes("x-7z") ||
    normalizedMimeType.includes("x-rar") ||
    matchesExtension(normalizedFileName, ARCHIVE_EXTENSIONS)
  ) {
    return "archive";
  }

  if (
    normalizedMimeType.startsWith("image/") ||
    matchesExtension(normalizedFileName, IMAGE_EXTENSIONS)
  ) {
    return "image";
  }

  if (
    normalizedMimeType.includes("csv") ||
    normalizedMimeType.includes("spreadsheet") ||
    normalizedMimeType.includes("parquet") ||
    normalizedMimeType.includes("arrow") ||
    normalizedMimeType.includes("ndjson") ||
    matchesExtension(normalizedFileName, DATASET_EXTENSIONS)
  ) {
    return "dataset";
  }

  if (
    normalizedMimeType.includes("markdown") ||
    normalizedMimeType.includes("prompt") ||
    normalizedFileName.includes("prompt") ||
    matchesExtension(normalizedFileName, PROMPT_EXTENSIONS)
  ) {
    return "prompt";
  }

  if (
    normalizedMimeType.startsWith("text/") ||
    normalizedMimeType.includes("pdf") ||
    normalizedMimeType.includes("wordprocessingml") ||
    matchesExtension(normalizedFileName, DOCUMENT_EXTENSIONS)
  ) {
    return "document";
  }

  if (
    normalizedMimeType.includes("javascript") ||
    normalizedMimeType.includes("typescript") ||
    normalizedMimeType.includes("python") ||
    normalizedMimeType.includes("json") ||
    normalizedMimeType.includes("yaml") ||
    normalizedMimeType.includes("toml") ||
    matchesExtension(normalizedFileName, SOURCE_EXTENSIONS)
  ) {
    return "source";
  }

  return "binary";
}

export function formatPrimeGatePackageTypeLabel(type: string) {
  switch (type) {
    case "archive":
      return "Archive";
    case "dataset":
      return "Dataset";
    case "document":
      return "Document";
    case "image":
      return "Image";
    case "prompt":
      return "Prompt";
    case "source":
      return "Source";
    case "binary":
      return "Binary";
    default:
      return type
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}
