import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedUploadUrl, sanitiseFilename, publicUrl } from "@/lib/storage/r2";
import { nanoid } from "nanoid";

const ALLOWED_DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const ALLOWED_MEDIA_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
];
const MAX_DOC_SIZE = 10 * 1024 * 1024;   // 10 MB
const MAX_MEDIA_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType, purpose, orgSlug } = await req.json();

  if (!filename || !contentType || !purpose || !orgSlug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isDocument = purpose === "document";
  const isMedia = purpose === "media";

  const allowedTypes = isDocument ? ALLOWED_DOC_TYPES : ALLOWED_MEDIA_TYPES;
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ error: `File type ${contentType} is not allowed` }, { status: 400 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const safeName = sanitiseFilename(filename.replace(/\.[^.]+$/, ""));
  const key = `${orgSlug}/${purpose}s/${new Date().getFullYear()}/${nanoid(10)}_${safeName}.${ext}`;

  try {
    const uploadUrl = await getPresignedUploadUrl(key, contentType, 600);
    return NextResponse.json({ uploadUrl, key, fileUrl: publicUrl(key) });
  } catch (err) {
    console.error("[presign] R2 error:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
