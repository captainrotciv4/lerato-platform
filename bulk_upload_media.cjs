require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaNeonHttp } = require("@prisma/adapter-neon");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs   = require("fs");
const path = require("path");

const adapter = new PrismaNeonHttp(process.env.DATABASE_URL, {});
const prisma  = new PrismaClient({ adapter });

const s3 = new S3Client({
  region:   process.env.R2_REGION ?? "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET    = process.env.R2_BUCKET_NAME;
const MEDIA_DIR = "C:\\Users\\USER\\OneDrive\\Pictures\\project-media";

// ── Event map: folder name → { eventId, orgId, orgSlug } ────────────────────
const EVENT_MAP = {
  "3rd july 2026": {
    subfolders: {
      "field assesment  and topology": {
        eventId: "cmrwdd7pc0001z4yh3ujuscfe",  // Field Assessment & Topology — Darajani
        orgId:   "cmqjfsxvm00018x4tfg3ykeq2",
        orgSlug: "darajani",
      },
      "Mentorship & Leadership": {
        eventId: "cmrwdd8dd0003z4yhfgdak8iw",  // Mentorship & Leadership — Lerato
        orgId:   "cmqjfsweh00008x4t1jzz1vi9",
        orgSlug: "lerato",
      },
    },
  },
  "4th july 2026": {
    eventId: "cmrwdd81c0002z4yhe29q2vw7",     // Training Session — Darajani
    orgId:   "cmqjfsxvm00018x4tfg3ykeq2",
    orgSlug: "darajani",
  },
  "12th july 2026": {
    eventId: "cmrwdd7cf0000z4yh2czg67y9",     // Match vs Mpesa Foundation — Darajani
    orgId:   "cmqjfsxvm00018x4tfg3ykeq2",
    orgSlug: "darajani",
  },
  "27th weekend june 2026": {
    eventId: "cmrwdd8p30004z4yha4i8ydmk",     // Weekend Community Engagement — Lerato
    orgId:   "cmqjfsweh00008x4t1jzz1vi9",
    orgSlug: "lerato",
  },
};

// ── Loose files in "3rd july 2026" root (DJI aerial shots) ──────────────────
// These belong with the field assessment event for Darajani
const JULY3_ROOT_CTX = {
  eventId: "cmrwdd7pc0001z4yh3ujuscfe",
  orgId:   "cmqjfsxvm00018x4tfg3ykeq2",
  orgSlug: "darajani",
};

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".avi": "video/avi",
  ".mkv": "video/x-matroska", ".mts": "video/mp2t",
};

function getMime(file) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

function isMedia(file) {
  return !!MIME[path.extname(file).toLowerCase()];
}

function isPhoto(mime) { return mime.startsWith("image/"); }
function isVideo(mime) { return mime.startsWith("video/"); }

async function uploadFile(filePath, key, mimeType) {
  const body = fs.readFileSync(filePath);
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    ContentType: mimeType,
    Body:        body,
  }));
}

let ADMIN_USER_ID = null;

async function processFolder(folderPath, ctx, looseFilesOnly = false) {
  const { eventId, orgId, orgSlug } = ctx;
  const files = fs.readdirSync(folderPath).filter(f => {
    const full = path.join(folderPath, f);
    if (!fs.statSync(full).isFile()) return false;
    if (!isMedia(f)) return false;
    return true;
  });

  let uploaded = 0, skipped = 0, errors = 0;

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const mimeType = getMime(file);
    const ext      = path.extname(file).toLowerCase().slice(1);
    const safeName = file.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const key      = `${orgSlug}/medias/2026/${eventId.slice(0,8)}_${safeName}`;
    const fileSize = fs.statSync(filePath).size;

    // Check if already uploaded (by key)
    const existing = await prisma.mediaAsset.findFirst({ where: { fileKey: key } });
    if (existing) { skipped++; continue; }

    try {
      await uploadFile(filePath, key, mimeType);

      await prisma.mediaAsset.create({
        data: {
          organizationId: orgId,
          eventId,
          uploadedById:   ADMIN_USER_ID,
          fileKey:        key,
          fileUrl:        key,   // presigned on display
          fileName:       file,
          mimeType,
          fileSize,
          mediaType:      isPhoto(mimeType) ? "PHOTO" : "VIDEO",
        },
      });

      uploaded++;
      if (uploaded % 20 === 0) process.stdout.write(`  ${uploaded}/${files.length}...\n`);
    } catch (err) {
      console.error(`  ERROR ${file}: ${err.message}`);
      errors++;
    }
  }

  return { uploaded, skipped, errors, total: files.length };
}

async function main() {
  console.log("Starting bulk media upload...\n");

  // Look up admin user ID
  const adminUser = await prisma.user.findFirst({
    where: { email: "victor@victormuoki.com" },
    select: { id: true },
  });
  if (!adminUser) throw new Error("Admin user not found — check email address");
  ADMIN_USER_ID = adminUser.id;
  console.log(`Admin user: ${ADMIN_USER_ID}\n`);

  let grandTotal = 0, grandUploaded = 0, grandSkipped = 0, grandErrors = 0;

  for (const [folderName, config] of Object.entries(EVENT_MAP)) {
    const folderPath = path.join(MEDIA_DIR, folderName);
    if (!fs.existsSync(folderPath)) {
      console.log(`SKIP  folder not found: ${folderName}`);
      continue;
    }

    if (config.subfolders) {
      // Process subfolders
      for (const [subName, ctx] of Object.entries(config.subfolders)) {
        const subPath = path.join(folderPath, subName);
        if (!fs.existsSync(subPath)) {
          console.log(`SKIP  subfolder not found: ${folderName}/${subName}`);
          continue;
        }
        console.log(`\n→ ${folderName} / ${subName} [${ctx.orgSlug}]`);
        const r = await processFolder(subPath, ctx);
        console.log(`  ✓ ${r.uploaded} uploaded, ${r.skipped} skipped, ${r.errors} errors`);
        grandTotal    += r.total;
        grandUploaded += r.uploaded;
        grandSkipped  += r.skipped;
        grandErrors   += r.errors;
      }
      // Also handle any loose media files directly in the parent folder
      if (JULY3_ROOT_CTX) {
        const looseFiles = fs.readdirSync(folderPath).filter(f => {
          const full = path.join(folderPath, f);
          return fs.statSync(full).isFile() && isMedia(f);
        });
        if (looseFiles.length > 0) {
          console.log(`\n→ ${folderName} / [root loose files → field assessment] [darajani]`);
          const r = await processFolder(folderPath, JULY3_ROOT_CTX, true);
          console.log(`  ✓ ${r.uploaded} uploaded, ${r.skipped} skipped, ${r.errors} errors`);
          grandTotal    += r.total;
          grandUploaded += r.uploaded;
          grandSkipped  += r.skipped;
          grandErrors   += r.errors;
        }
      }
    } else {
      console.log(`\n→ ${folderName} [${config.orgSlug}]`);
      const r = await processFolder(folderPath, config);
      console.log(`  ✓ ${r.uploaded} uploaded, ${r.skipped} skipped, ${r.errors} errors`);
      grandTotal    += r.total;
      grandUploaded += r.uploaded;
      grandSkipped  += r.skipped;
      grandErrors   += r.errors;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Total: ${grandTotal} files | ${grandUploaded} uploaded | ${grandSkipped} skipped | ${grandErrors} errors`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
