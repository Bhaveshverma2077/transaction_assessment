/**
 * Financial rounding utility to prevent JavaScript floating point inaccuracies.
 * (e.g. 0.1 + 0.2 = 0.30000000000000004)
 */

const roundToTwoDecimals = (num) => {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
};

const toCents = (num) => {
  return Math.round(Number(num) * 100);
};

const fromCents = (cents) => {
  return Number((cents / 100).toFixed(2));
};

module.exports = {
  roundToTwoDecimals,
  toCents,
  fromCents,
};
