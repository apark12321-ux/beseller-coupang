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

// 기존 DB에 저장된 짧은 고시정보명을 쿠팡이 받는 표준 고시정보명으로 보정한다.
// 특히 가공식품의 8~11번 항목은 짧은 명칭을 보내면 쿠팡이 JSON 검증 오류를 반환한다.
function normalizeNoticeDetailName(categoryName: string, detailName: string): string {
  if (categoryName === "가공식품") {
    const map: Record<string, string> = {
      "생산자 및 소재지": "생산자 및 소재지(수입품의 경우 생산자, 수입자 및 제조국)",
      "유전자변형식품 해당 여부": "유전자변형식품에 해당하는 경우의 표시",
      "소비자안전 주의사항": "소비자안전을 위한 주의사항",
      "수입식품 문구": "수입식품안전관리특별법에 따른 수입신고를 필함",
      "소비자상담 전화번호": "소비자상담 관련 전화번호",
    };
    return map[detailName] ?? detailName;
  }

  if (categoryName === "농수산물") {
    const map: Record<string, string> = {
      "소비자안전 주의사항": "소비자안전을 위한 주의사항",
      "소비자상담 전화번호": "소비자상담 관련 전화번호",
    };
    return map[detailName] ?? detailName;
  }

  return detailName;
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
    noticeCategoryDetailName: normalizeNoticeDetailName(p.notice.noticeCategoryName, f.name),
    content: f.content,
  }));

  const item = {
    itemName: o.itemName,
    originalPrice: o.originalPrice,
    salePrice: o.salePrice,
    maximumBuyCount: 9999,
    maximumBuyForPerson: 0,
    maximumBuyForPersonPeriod: 1,
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
    manufacture: "계절식감",
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
