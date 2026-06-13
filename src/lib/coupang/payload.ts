import { Product } from "../types";
import { env, DELIVERY, CS_PHONE } from "../config";
import { toAttributes } from "../pipeline/options";
import { buildContents } from "../pipeline/images";

// Product → 쿠팡 sellerProduct 생성 payload.
// requested=false 로 임시저장만. saleStartedAt/EndedAt 자동 설정.

function isoPlus(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 19);
}

export function buildPayload(p: Product, requested = false, resolvedCategoryCode?: string | null) {
  const o = p.option;
  const attributes = toAttributes(o);
  const contents = buildContents(p.images);

  const images = p.images.representationUrl
    ? [{ imageOrder: 0, imageType: "REPRESENTATION", vendorPath: p.images.representationUrl }]
    : [];

  const notices = p.notice.fields.map((f) => ({
    noticeCategoryName: p.notice.noticeCategoryName,
    noticeCategoryDetailName: f.name,
    content: f.content,
  }));

  const item = {
    itemName: o.itemName,
    originalPrice: o.originalPrice,
    salePrice: o.salePrice,
    maximumBuyCount: 9999,
    maximumBuyForPerson: 0,
    outboundShippingTimeDay: DELIVERY.outboundShippingTimeDay,
    unitCount: o.quantity,
    adultOnly: "EVERYONE",
    taxType: p.category.taxType === "FREE" ? "FREE" : "TAX",
    parallelImported: "NOT_PARALLEL_IMPORTED",
    overseasPurchased: "NOT_OVERSEAS_PURCHASED",
    pccNeeded: false,
    externalVendorSku: o.sku,
    emptyBarcode: true,
    emptyBarcodeReason: "상품확인후 등록",
    attributes,
    contents,
    notices,
    images,
  };

  return {
    displayCategoryCode: resolvedCategoryCode ?? p.category.displayCategoryCode,
    sellerProductName: p.finalName,
    vendorId: env.vendorId,
    saleStartedAt: isoPlus(0),
    saleEndedAt: isoPlus(5),
    displayProductName: p.finalName,
    brand: "계절식감",
    deliveryMethod: DELIVERY.deliveryMethod,
    deliveryCompanyCode: DELIVERY.deliveryCompanyCode,
    deliveryChargeType: DELIVERY.deliveryChargeType,
    deliveryCharge: DELIVERY.deliveryCharge,
    freeShipOverAmount: DELIVERY.freeShipOverAmount,
    deliveryChargeOnReturn: DELIVERY.deliveryChargeOnReturn,
    remoteAreaDeliverable: DELIVERY.remoteAreaDeliverable,
    unionDeliveryType: DELIVERY.unionDeliveryType,
    returnCenterCode: env.returnCenterCode,
    returnChargeName: DELIVERY.returnChargeName,
    companyContactNumber: CS_PHONE,
    returnZipCode: DELIVERY.returnZipCode,
    returnAddress: DELIVERY.returnAddress,
    returnAddressDetail: DELIVERY.returnAddressDetail,
    returnCharge: DELIVERY.returnCharge,
    outboundShippingPlaceCode: Number(env.outboundShippingPlaceCode),
    vendorUserId: env.vendorUserId,
    requested, // false = 임시저장
    items: [item],
  };
}
