// Shared helper for item-level Order Cancellation, Delivery Boy Filtering,
// and Single-Item Return / Exchange across Customer, Admin, and Delivery Boy portals.

export const parseOrderItems = (order) => {
  if (!order) return [];
  let raw =
    order?.items ??
    order?.products ??
    order?.cartItems ??
    [];

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }

  if (!Array.isArray(raw)) {
    raw = raw && typeof raw === "object" ? [raw] : [];
  }

  return raw.filter(Boolean);
};

export const isOrderItemCancelled = (item) => {
  if (!item) return false;
  if (Boolean(item.isCancelled)) return true;
  const st = String(item.status || "")
    .trim()
    .toUpperCase();
  return st === "CANCELLED" || st === "CANCELED";
};

export const getActiveDeliveryItems = (order) => {
  const all = parseOrderItems(order);
  return all.filter((item) => !isOrderItemCancelled(item));
};

export const getCancelledOrderItems = (order) => {
  const all = parseOrderItems(order);
  return all.filter((item) => isOrderItemCancelled(item));
};

export const getOrderItemSellingPrice = (item) => {
  const orig = Number(
    item?.price ??
      item?.sellingPrice ??
      item?.productPrice ??
      item?.amount ??
      0
  );
  const disc = Number(item?.discount || 0);
  if (disc > 0 && orig > 0) {
    return orig - (orig * disc) / 100;
  }
  return orig;
};

export const getOrderItemId = (item) => {
  return String(
    item?.productId || item?.id || item?.$id || item?.productID || ""
  ).trim();
};

export const getOrderItemName = (item) => {
  return String(
    item?.title || item?.name || item?.productName || "Product"
  ).trim();
};

export const getOrderItemImage = (item) => {
  const rawImg =
    item?.thumbnail ||
    item?.image ||
    item?.img ||
    item?.productImage ||
    (Array.isArray(item?.images) ? item.images[0] : "");
  return String(rawImg || "").trim();
};

const sanitizeMetaValue = (val) =>
  String(val ?? "")
    .replace(/[|\]]/g, " ")
    .trim();

export const formatReasonWithItem = (cleanReason, item, itemIndex = 0) => {
  const baseReason = extractCleanReason(cleanReason);
  if (!item) return baseReason;

  const idx = Number.isInteger(Number(itemIndex)) && Number(itemIndex) >= 0 ? Number(itemIndex) : 0;
  const id = sanitizeMetaValue(getOrderItemId(item));
  const name = sanitizeMetaValue(getOrderItemName(item));
  const qty = Number(item?.quantity ?? item?.qty ?? 1) || 1;
  const price = Math.round(getOrderItemSellingPrice(item) * 100) / 100;

  return `[ITEM:idx=${idx}|id=${id}|name=${name}|qty=${qty}|price=${price}] ${baseReason}`.trim();
};

export const parseReasonItemMeta = (rawReason) => {
  const text = String(rawReason || "").trim();
  const match = text.match(/^\[ITEM:([^\]]+)\]\s*(.*)$/s);
  if (!match) {
    return {
      hasMeta: false,
      itemIndex: -1,
      itemId: "",
      itemName: "",
      itemQty: 1,
      itemPrice: 0,
      cleanReason: text,
    };
  }

  const metaPart = match[1] || "";
  const cleanReason = String(match[2] || "").trim();
  const map = {};

  metaPart.split("|").forEach((pair) => {
    const eqIdx = pair.indexOf("=");
    if (eqIdx > 0) {
      const k = pair.slice(0, eqIdx).trim();
      const v = pair.slice(eqIdx + 1).trim();
      map[k] = v;
    }
  });

  const parsedIdx =
    map.idx !== undefined && map.idx !== "" ? Number(map.idx) : -1;

  return {
    hasMeta: true,
    itemIndex: Number.isInteger(parsedIdx) ? parsedIdx : -1,
    itemId: map.id || "",
    itemName: map.name || "",
    itemQty: Number(map.qty || 1) || 1,
    itemPrice: Number(map.price || 0) || 0,
    cleanReason: cleanReason || text,
  };
};

export const extractCleanReason = (rawReason) => {
  return parseReasonItemMeta(rawReason).cleanReason;
};

export const doesRequestMatchItem = (
  request,
  item,
  itemIndex = -1,
  order = null
) => {
  if (!request || !item) return false;

  const reqRef = String(request?.referenceId || "").trim();
  const reqId = String(request?.$id || "").trim();
  const itemRef = String(item?.returnReferenceId || "").trim();
  const itemReqId = String(item?.returnRequestId || "").trim();

  if (reqRef && itemRef && reqRef === itemRef) {
    return true;
  }
  if (reqId && itemReqId && reqId === itemReqId) {
    return true;
  }

  const meta = parseReasonItemMeta(request?.reason);
  if (meta.hasMeta) {
    if (
      meta.itemIndex >= 0 &&
      Number.isInteger(Number(itemIndex)) &&
      Number(itemIndex) >= 0
    ) {
      return meta.itemIndex === Number(itemIndex);
    }
    const thisId = getOrderItemId(item);
    if (meta.itemId && thisId && meta.itemId === thisId) {
      return true;
    }
    const thisName = getOrderItemName(item).toLowerCase();
    if (
      meta.itemName &&
      thisName &&
      meta.itemName.toLowerCase() === thisName
    ) {
      return true;
    }
    return false;
  }

  // If the order has any item explicitly tagged with this request's referenceId/$id,
  // then only that tagged item matches.
  const allItems = parseOrderItems(order);
  if (allItems.length > 0 && (reqRef || reqId)) {
    const taggedIdx = allItems.findIndex(
      (it) =>
        (reqRef && String(it?.returnReferenceId || "").trim() === reqRef) ||
        (reqId && String(it?.returnRequestId || "").trim() === reqId)
    );
    if (taggedIdx >= 0) {
      if (Number.isInteger(Number(itemIndex)) && Number(itemIndex) >= 0) {
        return taggedIdx === Number(itemIndex);
      }
      return allItems[taggedIdx] === item;
    }
  }

  // Fallback for legacy requests without item metadata:
  // Match the first non-cancelled item in the order (never a cancelled item).
  if (isOrderItemCancelled(item)) {
    return false;
  }

  if (allItems.length > 0) {
    const firstActiveIdx = allItems.findIndex(
      (it) => !isOrderItemCancelled(it)
    );
    if (
      firstActiveIdx >= 0 &&
      Number.isInteger(Number(itemIndex)) &&
      Number(itemIndex) >= 0
    ) {
      return firstActiveIdx === Number(itemIndex);
    }
  }

  return true;
};

export const resolveReturnRequestItem = (request, order = null) => {
  const allItems = parseOrderItems(order);
  const meta = parseReasonItemMeta(request?.reason);
  const reqRef = String(request?.referenceId || "").trim();
  const reqId = String(request?.$id || "").trim();

  // 1. Check explicit tag on order.items
  if (allItems.length > 0 && (reqRef || reqId)) {
    const taggedIdx = allItems.findIndex(
      (it) =>
        (reqRef && String(it?.returnReferenceId || "").trim() === reqRef) ||
        (reqId && String(it?.returnRequestId || "").trim() === reqId)
    );
    if (taggedIdx >= 0) {
      const matched = allItems[taggedIdx];
      return {
        item: matched,
        itemIndex: taggedIdx,
        itemName: getOrderItemName(matched),
        itemQty: Number(matched?.quantity ?? matched?.qty ?? 1) || 1,
        itemPrice: getOrderItemSellingPrice(matched),
        itemImage: getOrderItemImage(matched),
        cleanReason: meta.cleanReason,
      };
    }
  }

  // 2. Check [ITEM:...] metadata from request.reason
  if (meta.hasMeta && allItems.length > 0) {
    if (meta.itemIndex >= 0 && meta.itemIndex < allItems.length) {
      const matched = allItems[meta.itemIndex];
      return {
        item: matched,
        itemIndex: meta.itemIndex,
        itemName: getOrderItemName(matched),
        itemQty: Number(matched?.quantity ?? matched?.qty ?? meta.itemQty ?? 1) || 1,
        itemPrice: getOrderItemSellingPrice(matched) || meta.itemPrice,
        itemImage: getOrderItemImage(matched),
        cleanReason: meta.cleanReason,
      };
    }

    const byIdOrNameIdx = allItems.findIndex((it) => {
      const itId = getOrderItemId(it);
      const itName = getOrderItemName(it).toLowerCase();
      if (meta.itemId && itId && meta.itemId === itId) return true;
      if (meta.itemName && itName && meta.itemName.toLowerCase() === itName) {
        return true;
      }
      return false;
    });

    if (byIdOrNameIdx >= 0) {
      const matched = allItems[byIdOrNameIdx];
      return {
        item: matched,
        itemIndex: byIdOrNameIdx,
        itemName: getOrderItemName(matched),
        itemQty: Number(matched?.quantity ?? matched?.qty ?? meta.itemQty ?? 1) || 1,
        itemPrice: getOrderItemSellingPrice(matched) || meta.itemPrice,
        itemImage: getOrderItemImage(matched),
        cleanReason: meta.cleanReason,
      };
    }
  }

  // 3. If meta exists even when order is not loaded yet
  if (meta.hasMeta && meta.itemName) {
    const fallbackItem = {
      id: meta.itemId || "return-item",
      productId: meta.itemId || "return-item",
      name: meta.itemName,
      title: meta.itemName,
      quantity: meta.itemQty || 1,
      qty: meta.itemQty || 1,
      price: meta.itemPrice || Number(request?.refundAmount || 0),
    };
    return {
      item: fallbackItem,
      itemIndex: meta.itemIndex >= 0 ? meta.itemIndex : 0,
      itemName: meta.itemName,
      itemQty: meta.itemQty || 1,
      itemPrice: meta.itemPrice || Number(request?.refundAmount || 0),
      itemImage: "",
      cleanReason: meta.cleanReason,
    };
  }

  // 4. Fallback to first non-cancelled item in order
  if (allItems.length > 0) {
    const activeIdx = allItems.findIndex((it) => !isOrderItemCancelled(it));
    const idx = activeIdx >= 0 ? activeIdx : 0;
    const matched = allItems[idx];
    return {
      item: matched,
      itemIndex: idx,
      itemName: getOrderItemName(matched),
      itemQty: Number(matched?.quantity ?? matched?.qty ?? 1) || 1,
      itemPrice: getOrderItemSellingPrice(matched),
      itemImage: getOrderItemImage(matched),
      cleanReason: meta.cleanReason,
    };
  }

  return {
    item: null,
    itemIndex: 0,
    itemName: "Product",
    itemQty: 1,
    itemPrice: Number(request?.refundAmount || 0),
    itemImage: "",
    cleanReason: meta.cleanReason,
  };
};

export const getReturnExchangeItemsForDelivery = (request, order = null) => {
  const resolved = resolveReturnRequestItem(request, order);
  if (resolved.item) {
    return [resolved.item];
  }
  return [];
};
