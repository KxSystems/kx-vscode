/*
 * Copyright (c) 1998-2025 KX Systems Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

/**
 * Decodes a string encoded in Q-encoding format
 * @param text The string to decode
 * @returns The decoded string
 */
export function decodeQUTF(text: string): any {
  if (typeof text === "undefined") {
    return text;
  }

  if (text === "1b" || text === "0b") {
    return text === "1b";
  }

  return text.replace(/(\\[^0-7])|(\\[0-7]{3})+/g, (text, notOctal) => {
    if (notOctal) {
      return text;
    }

    return text
      .replace(/\\[23][0-7]{2}/g, decodeOctal)
      .split(
        /((?:[!-~]|[\xc0-\xdf][\x80-\xbf]|[\xe0-\xef][\x80-\xbf]{2}|[\xf0-\xf7][\x80-\xbf]{3}|[\u0100-\uFFFF])+)/,
      )
      .map(decodeUnicode)
      .join("");
  });
}

/**
 * Decodes a string encoded in Unicode format
 * @param str The string to decode
 * @param i The index of the string
 * @returns The decoded string
 */
export function decodeUnicode(str: string, i: number): string {
  const ODD_INDEX = 1;

  if (i % 2 === ODD_INDEX) {
    return str.replace(/[\x80-\xff]+/g, (encodedString) => {
      let acc = "";
      for (let j = 0; j < encodedString.length; j++) {
        const num = encodedString.charCodeAt(j).toString(16);
        acc += `%${num.length === 1 ? "0" : ""}${num}`;
      }
      try {
        return decodeURIComponent(acc);
      } catch {
        return toOctalEscapes(encodedString);
      }
    });
  } else {
    return toOctalEscapes(str);
  }
}

/**
 * Encodes non-ASCII characters in a string as octal escape sequences
 * @param str The string to encode
 * @returns The encoded string
 */
export function toOctalEscapes(str: string): string {
  let acc = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    acc += code < 128 ? str[i] : `\\${str.charCodeAt(i).toString(8)}`;
  }
  return acc;
}

/**
 * Decodes an octal escape sequence to a character
 * @param octalSequence The string that matched the regex
 * @returns The decoded escape sequence
 */
export function decodeOctal(octalSequence: string): string {
  return String.fromCharCode(parseInt(octalSequence.substring(1), 8));
}
