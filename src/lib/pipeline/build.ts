import { RawRow } from "./csv";
import { Product } from "../types";
import { classify } from "./classify";
import { matchCategory } from "./category";
import { generateNames } from "./name";
import { calcPrice, calcPriceWithSettings } from "./price";
import { toOptionInfo } from "./options";
import { buildImageSet } from "./images";
import { buildNotice, isAgriMarine } from "./notice";
import { Settings } from "../types";
import { DEFAULT_SETTINGS } from "../config";
import crypto from "crypto";

// RawRow → Product. 업로드 시 1회 자동 실행.

export function buildProduct(row: RawRow, uploadId: string, rowIndex: number, settings: Settings = DEFAULT_SETTINGS): Product {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const cls = classify(row.categoryCode, row.name);
  const category = matchCategory(row.categoryCode, row.categoryLabel, row.name, cls.status, row.vatType);
  const names = generateNames(row.name);
  const price = calcPriceWithSettings(row.supplyPrice, settings);
  const sku = row.sku || `${uploadId.slice(0, 8)}-${rowIndex}`;
  const option = toOptionInfo(row.name, sku, price.salePrice, price.originalPrice);
  const images = buildImageSet(row.detailImages, settings.imageBaseUrl);
  const notice = buildNotice(isAgriMarine(row.categoryCode), option.packageUnit, row.origin);

  const blockReasons: string[] = [];
  if (cls.reason) blockReasons.push(cls.reason);
  if (price.warning) blockReasons.push(price.warning);
  if (category.status === "mismatch_warning" && category.reason) blockReasons.push(category.reason);

  return {
    id,
    uploadId,
    rowIndex,
    externalVendorSku: sku,
    originalName: row.name,
    beSellerCode: row.categoryCode || "",
    finalName: names.finalName,
    nameCandidates: names.candidates,
    nameSource: "auto",
    supplyPrice: row.supplyPrice,
    status: cls.status,
    blockReasons,
    category,
    option,
    notice,
    images,
    rawImages: row.detailImages,
    userEditedFields: [],
    dryRunOk: false,
    lastErrorClass: null,
    lastResultSummary: null,
    createdAt: now,
    updatedAt: now,
  };
}
