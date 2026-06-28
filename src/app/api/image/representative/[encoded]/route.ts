import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OUTPUT_SIZE = 800;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

function isAllowedImageHost(hostname: string) {
  return (
    hostname === "beseller.net" ||
    hostname.endsWith(".beseller.net") ||
    hostname === "beseller.img50.makeshop.info" ||
    hostname.endsWith(".makeshop.info")
  );
}

function decodeSourceUrl(encodedWithExt: string): string {
  const encoded = encodedWithExt.replace(/\.jpe?g$/i, "");
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

async function renderRepresentativeImage(raw: string) {
  let source: URL;
  try {
    source = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_URL" }, { status: 400 });
  }

  if (!/^https?:$/.test(source.protocol) || !isAllowedImageHost(source.hostname)) {
    return NextResponse.json({ ok: false, error: "IMAGE_HOST_NOT_ALLOWED" }, { status: 400 });
  }

  const upstream = await fetch(source.toString(), {
    headers: {
      "user-agent": "Mozilla/5.0 CoupangImageNormalizer/1.0",
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    },
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: "SOURCE_IMAGE_FETCH_FAILED", httpStatus: upstream.status },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "SOURCE_NOT_IMAGE", contentType }, { status: 415 });
  }

  const input = Buffer.from(await upstream.arrayBuffer());
  if (input.byteLength > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { ok: false, error: "SOURCE_IMAGE_TOO_LARGE", bytes: input.byteLength },
      { status: 413 },
    );
  }

  try {
    const output = await sharp(input, { limitInputPixels: 10000 * 10000 })
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    return new NextResponse(output, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(output.byteLength),
        "cache-control": "public, max-age=31536000, immutable",
        "x-representative-image-normalized": "800x800-jpeg-path",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "IMAGE_NORMALIZE_FAILED", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function GET(_: Request, context: { params: { encoded: string } }) {
  const raw = decodeSourceUrl(context.params.encoded);
  return renderRepresentativeImage(raw);
}
