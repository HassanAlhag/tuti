function makeError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isBuildYourBoxItem(item) {
  return item?.configuration?.type === "build_your_box";
}

function addStockLine(lines, productId, quantity) {
  if (!productId) return;
  const existing = lines.get(productId);
  lines.set(productId, (existing || 0) + Number(quantity || 0));
}

export function resolveOrderStockLines(items) {
  const lines = new Map();

  for (const item of items) {
    if (isBuildYourBoxItem(item)) {
      addStockLine(lines, item.configuration?.selectedPerfume?.productId, item.quantity);
      addStockLine(lines, item.configuration?.selectedTreat?.productId, item.quantity);
      continue;
    }
    addStockLine(lines, item.productId, item.quantity);
  }

  return [...lines.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function assertSeedStockAvailable(products, stockLines) {
  for (const line of stockLines) {
    const product = products.find((item) => item.id === line.productId);
    if (!product) throw makeError(`Product not found for stock deduction: ${line.productId}.`, 404);
    if (Number(product.stock || 0) < line.quantity) {
      throw makeError(`Insufficient stock for ${product.name || line.productId}.`, 409);
    }
  }
}

export function deductSeedStock(products, stockLines) {
  assertSeedStockAvailable(products, stockLines);
  for (const line of stockLines) {
    const product = products.find((item) => item.id === line.productId);
    product.stock -= line.quantity;
    product.orders += line.quantity;
  }
}

export async function preflightMongoStock(ProductModel, stockLines) {
  if (!stockLines.length) return [];

  const productIds = stockLines.map((line) => line.productId);
  const products = await ProductModel.find({ id: { $in: productIds } }).lean();

  for (const line of stockLines) {
    const product = products.find((item) => item.id === line.productId);
    if (!product) throw makeError(`Product not found for stock deduction: ${line.productId}.`, 404);
    if (Number(product.stock || 0) < line.quantity) {
      throw makeError(`Insufficient stock for ${product.name || line.productId}.`, 409);
    }
  }

  return products;
}

export async function rollbackMongoStock(ProductModel, stockLines) {
  for (const line of [...stockLines].reverse()) {
    await ProductModel.updateOne(
      { id: line.productId },
      { $inc: { stock: line.quantity, orders: -line.quantity } }
    );
  }
}

export async function deductMongoStockWithRollback(ProductModel, stockLines) {
  await preflightMongoStock(ProductModel, stockLines);

  const applied = [];
  try {
    for (const line of stockLines) {
      const result = await ProductModel.updateOne(
        { id: line.productId, stock: { $gte: line.quantity } },
        { $inc: { stock: -line.quantity, orders: line.quantity } }
      );
      if (result.matchedCount !== 1 || result.modifiedCount !== 1) {
        throw makeError(`Insufficient stock for ${line.productId}.`, 409);
      }
      applied.push(line);
    }
    return applied;
  } catch (error) {
    await rollbackMongoStock(ProductModel, applied);
    throw error;
  }
}
