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

// @ts-nocheck

import moment from "moment";
import "moment-duration-format";
import "moment-timezone";

declare module "moment" {
  interface Moment {
    kdbType(value?: string): string;
    nanosecond(value?: number): number;
    nanoseconds(value?: number): number;
    formatNano(format?: string, options?: any): string;
    toDashString(): string;
    toKdbObject(): any;
    toISOStringNano(): string;
    valueOfNano(): number;
  }
  interface Duration {
    kdbType(value?: string): string;
    nanosecond(value?: number): number;
    nanoseconds(value?: number): number;
    format(format?: string, options?: any): string;
    formatNano(format?: string, options?: any): string;
    toDashString(): string;
    toKdbObject(): any;
    toISOStringNano(): string;
    valueOfNano(): number;
  }
}

const padLeft = (input: string, length: number, padChar: string) => {
  const str = String(input);
  if (!str) {
    return "";
  }

  if (!padChar) {
    padChar = "0";
  }

  if (str.length > length) {
    return str;
  }

  return (Array(length + 1).join(padChar) + str).slice(length * -1);
};

moment.duration.fn.kdbType = moment.prototype.kdbType = function (type) {
  if (type !== undefined && type !== null) {
     
    this._kdbType = type;
  } else {
     
    return this._kdbType || null;
  }
};

moment.duration.fn.nanosecond =
  moment.prototype.nanosecond =
  moment.duration.fn.nanoseconds =
  moment.prototype.nanoseconds =
    function (value) {
      if (value !== undefined && value !== null) {
         
        this._n = value;
      } else {
         
        return this._n || 0;
      }
    };

moment.duration.fn.formatNano = moment.prototype.formatNano = function (
  format,
  options
) {
  let nanoFormat = "";
  let paddedNanos;
  let suffix = "";
  let trimmedFormat;
  let value;

  if (!format) format = "YYYY-MM-DDTHH:mm:ss.SSSSSSSSS";

  if (format.slice(-1) === "Z") {
    suffix = "Z";
    if (format.slice(-10) === "SSSSSSSSSZ") {
      nanoFormat = "SSSSSSSSS";
      trimmedFormat = format.slice(0, -11);
    } else if (format.slice(-7) === "SSSSSSZ") {
      nanoFormat = "SSSSSS";
      trimmedFormat = format.slice(0, -8);
    } else if (format.slice(-4) === "SSSZ") {
      nanoFormat = "SSS";
      trimmedFormat = format.slice(0, -5);
    }
  } else {
    if (format.slice(-9) === "SSSSSSSSS") {
      nanoFormat = "SSSSSSSSS";
      trimmedFormat = format.slice(0, -10);
    } else if (format.slice(-6) === "SSSSSS") {
      nanoFormat = "SSSSSS";
      trimmedFormat = format.slice(0, -7);
    } else if (format.slice(-3) === "SSS") {
      nanoFormat = "SSS";
      trimmedFormat = format.slice(0, -4);
    }
  }
  if (
    nanoFormat &&
    (this.nanoseconds() || (options && options.trimNano === false))
  ) {
    value = this.format(trimmedFormat, options);
    paddedNanos = padLeft(
      Math.abs(this.milliseconds() * 1000000 + this.nanoseconds()),
      9
    );
    value += "." + paddedNanos.substring(0, nanoFormat.length);
    value += suffix || "";
  } else {
    value = this.format(format, options);
  }
  return value;
};

moment.prototype.format = (function (fn) {
  return function (inputString) {
    const decPlaces = inputString ? inputString.match(/S/g) : undefined;
    let formatted = inputString
      ? fn.apply(this, [inputString])
      : fn.apply(this);

    if (decPlaces && decPlaces.length > 3) {
      const decimals = formatted.substr(formatted.lastIndexOf(".") + 1);
      const ms = this.millisecond().toString();
      const ns = this.nanosecond().toString();
      const padding = ms.padStart(3, "0") + ns.padStart(6, "0");
      const decimalLength = decPlaces.length;
      const nanos = padding.substring(0, decimalLength);
      formatted = formatted.replace(decimals, nanos);
    }

    return formatted;
  };
})(moment.prototype.format);

moment.prototype.toDashString = function () {
  let value;

  switch (this.kdbType()) {
    case "1212":
      value = this.toISOString();
      value = value.substr(0, 23) + padLeft(this.nanoseconds(), 6) + "Z";
      break;
    case "1213":
      value = this.format("YYYY-MM");
      break;
    case "1214":
      value = this.format("YYYY-MM-DD");
      break;
    default:
      value = this.toISOString();
      break;
  }

  return value;
};

moment.duration.fn.toDashString = function () {
  let value =
    "1970-01-01T" + this.format("HH:mm:ss.SSS", { trim: false }) + "Z";

  switch (this.kdbType()) {
    case "1216":
      value = value.substr(0, 23) + padLeft(this.nanoseconds(), 6) + "Z";
      break;
  }

  return value;
};

moment.duration.fn.toKdbObject = moment.prototype.toKdbObject = function () {
  const type = this.kdbType() || "1212";

  const kdbObject = {
    class: type,
  };

  switch (type) {
    case "1212":
      kdbObject.i = this.valueOf();
      kdbObject.n = this.milliseconds() * 1000000 + this.nanoseconds();
      break;
    case "1213":
      kdbObject.i = Math.round(this.diff(moment([2000]), "months", true));
      break;
    case "1214":
    case "1215":
      kdbObject.i = this.valueOf();
      break;
    case "1216":
      kdbObject.i = this.valueOfNano();
      break;
    case "1217":
      kdbObject.i = this.asMinutes();
      break;
    case "1218":
      kdbObject.i = this.asSeconds();
      break;
    case "1219":
      kdbObject.i = this.valueOf();
      break;
  }

  kdbObject.toString = function () {
    return this.toDashString();
  }.bind(this);

  return kdbObject;
};

moment.prototype.toISOStringNano = function () {
  const value = this.toISOString();
  if (value) {
    return value.substr(0, 23) + padLeft(this.nanoseconds(), 6) + "Z";
  }
  return value;
};

moment.duration.fn.toISOStringNano = function () {
  const value =
    "1970-01-01T" + this.format("HH:mm:ss.SSS", { trim: false }) + "Z";

  return value.substr(0, 23) + padLeft(this.nanoseconds(), 6) + "Z";
};

moment.duration.fn.valueOfNano = moment.prototype.valueOfNano = function () {
  let value = this.valueOf() * 1000000;

   
  if (typeof this._n === "number") {
    value += this.nanoseconds();
  }

  return value;
};

export default moment;
