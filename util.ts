import type { BigNumberish } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';

export function shortenHex(hex: string, length = 4) {
  return `${hex.substring(0, length + 2)}…${hex.substring(
    hex.length - length
  )}`;
}

export const parseBigNumber = (
  value: BigNumberish,
  decimals = 18,
  decimalsToDisplay = 3
) => parseFloat(formatUnits(value, decimals)).toFixed(decimalsToDisplay);

export const delayMS = (t = 200) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(t);
    }, t);
  });
};

export async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

export function split(arr, n) {
  const res = [];
  while (arr.length) {
    res.push(arr.splice(0, n));
  }
  return res;
}

export const throttledPromises = (
  asyncFunction,
  items = [],
  batchSize = 1,
  delay = 0
) => {
  return new Promise(async (resolve, reject) => {
    const output = [];
    const batches = split(items, batchSize);
    await asyncForEach(batches, async (batch) => {
      const promises = batch.map(asyncFunction).map((p) => p.catch(reject));
      const results = await Promise.all(promises);
      output.push(...results);
      await delayMS(delay);
    });
    resolve(output);
  });
};

export const normalizeMetadata = (tokenURIResponse: string) => {
  const metadata64 = tokenURIResponse.replace(
    'data:application/json;base64,',
    ''
  );
  const metadataBuffer = Buffer.from(metadata64, 'base64');
  const jsonData = JSON.parse(metadataBuffer.toString('utf-8'));
  return jsonData;
};

export const normalizeTokenData = (tokenData: [string, string]) => {
  const tokenHTML = tokenData[0];
  const tokenMetadata = tokenData[1];

  const fontMatches = tokenHTML.match(
    /<style>(@font-face {font-family:\'(M.*)\'.*format\(.*?;})/
  );
  let fontString = '';
  if (fontMatches[1]) {
    fontString = fontString.concat(fontMatches[1]);
  }
  const fontFamily = fontMatches[2];
  const seedMatches = tokenHTML.match(/SEED=(.*?);/);
  const seedValue = seedMatches[1];

  const { name, attributes } = normalizeMetadata(tokenMetadata);

  return {
    attributes,
    fontFamily,
    fontString,
    name,
    seedValue,
  };
};
