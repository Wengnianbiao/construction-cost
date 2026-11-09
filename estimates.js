const storageKey = "construction-cost:projects:v1";
const maxQuantity = 999_999_999_999n;
const maxPrice = 999_999_999_999n;
const maxRate = 10_000n;

function scaledInteger(value, places, maximum, label) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(value);
  const error = () => new Error(`请检查${label}的数值和小数位数。`);
  if (!match || !(match[2] || match[3])) throw error();

  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const digits = (whole + fraction).replace(/^0+/, "");
  if (!digits) return 0n;

  const significant = digits.replace(/0+$/, "");
  const shift = Number(exponent) + places - fraction.length + digits.length - significant.length;
  if (sign === "-" || !Number.isSafeInteger(shift) || shift < 0
      || significant.length + shift > maximum.toString().length) {
    throw error();
  }
  const scaled = BigInt(significant) * 10n ** BigInt(shift);
  if (scaled > maximum) throw error();
  return scaled;
}

function formatMoney(cents) {
  const digits = cents.toString().padStart(3, "0");
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

function roundHalfUp(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

export function calculateEstimate(estimate) {
  if (!estimate.name) throw new Error("请填写项目名称。");
  const rate = scaledInteger(estimate.reserve_rate, 2, maxRate, "预备费率");
  const inputs = estimate.mode === "area"
    ? [{ name: "建筑面积估算", unit: "㎡", quantity: estimate.area, unit_price: estimate.unit_price }]
    : estimate.items;

  let subtotal = 0n;
  const lines = inputs.map(line => {
    if (!line.name || !line.unit) throw new Error("请填写清单名称和单位。");
    const quantity = scaledInteger(line.quantity, 3, maxQuantity, "面积或工程量");
    if (quantity === 0n) throw new Error("面积和工程量必须大于零。");
    const price = scaledInteger(line.unit_price, 2, maxPrice, "单价");
    const amount = roundHalfUp(quantity * price, 1000n);
    subtotal += amount;
    return { ...line, unit_price: formatMoney(price), amount: formatMoney(amount) };
  });
  const reserve = roundHalfUp(subtotal * rate, 10_000n);
  return {
    estimate,
    lines,
    subtotal: formatMoney(subtotal),
    reserve_amount: formatMoney(reserve),
    total_amount: formatMoney(subtotal + reserve),
  };
}

export function readProjects() {
  try {
    const records = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(records)) throw new Error();
    return records;
  } catch {
    throw new Error("无法读取此浏览器的历史项目。");
  }
}

export function saveProject(result, id) {
  const projects = readProjects();
  const saved = {
    ...result,
    id: id ?? crypto.randomUUID(),
    updated_at: new Date().toISOString(),
  };
  const updated = [saved, ...projects.filter(project => project.id !== saved.id)];
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    throw new Error("浏览器存储不可用或已满，无法保存项目。");
  }
  return saved;
}
