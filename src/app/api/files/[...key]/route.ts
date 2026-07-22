import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedDownloadUrl } from "@/lib/storage/r2";

// GET /api/files/[...key] — generate a presigned download URL and redirect
// Used by media library and document viewer to serve private B2 files
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  try {
    const url = await getPresignedDownloadUrl(key, 3600); // 1h expiry
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error("[files] presign error:", err);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
