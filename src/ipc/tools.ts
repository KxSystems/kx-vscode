/*
 * Copyright (c) 1998-2023 Kx Systems Inc.
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

import moment from "./moment.custom";
interface ToolsTypesObj {
  dashboardToKdb: { [key: string]: string };
  kdbTemporals: string[];
  kdbToDashboard: { [key: string]: string };
}

export default class Tools {
  static types: ToolsTypesObj = {
    dashboardToKdb: {
      timestamp: "1212",
      month: "1213",
      date: "1214",
      datetime: "1215",
      timespan: "1216",
      minute: "1217",
      second: "1218",
      time: "1219",
    },
    kdbTemporals: [
      "1212",
      "1213",
      "1214",
      "1215",
      "1216",
      "1217",
      "1218",
      "1219",
    ],
    kdbToDashboard: {
      1212: "timestamp",
      1213: "month",
      1214: "date",
      1215: "datetime",
      1216: "timespan",
      1217: "minute",
      1218: "second",
      1219: "time",
    },
  };

  static timezone = moment.tz.guess();

  static binarySearch<T, S>(
    element: T,
    array: S[],
    compareFn: (aValue: T, b: S) => 1 | -1 | 0
  ): number {
    let mid = 0;
    let n = array.length - 1;
    let cmp;
    let i;

    while (mid <= n) {
      // eslint-disable-next-line no-bitwise
      i = (n + mid) >> 1;
      cmp = compareFn(element, array[i]);
      if (cmp > 0) {
        mid = i + 1;
      } else if (cmp < 0) {
        n = i - 1;
      } else {
        return i;
      }
    }

    // returns a negative value indicating the insertion point
    // for the new element if the element is not found
    return -mid - 1;
  }

  static convertKDBToViewstateValue(value: any): string {
    let toReturn = value;

    if (value.class) {
      toReturn =
        value.class === "1222"
          ? value.toString()
          : Tools.convertKDBTemporalToMoment(value).toDashString();
    }

    return toReturn;
  }

  static convertKDBTemporalToMoment(
    value: any
  ): moment.Moment | moment.Duration {
    let applyUserTimezone = false;
    let m;

    if (
      value &&
      typeof value.i === "number" &&
      Tools.types.kdbTemporals.indexOf(value.class) !== -1
    ) {
      switch (value.class) {
        case "1212":
          m = moment.tz(value.i, "UTC");
          m.nanoseconds(value.n % 1000000);
          applyUserTimezone = true;
          break;
        case "1213":
          m = moment.tz("2000-01-01", "UTC");
          m.add(value.i, "month");
          break;
        case "1214":
          m = moment.tz(value.toString(), "UTC");
          break;
        case "1216":
          m = moment.duration(
            value.i > 0
              ? Math.floor(value.i / 1000000)
              : Math.ceil(value.i / 1000000)
          );
          m.nanoseconds(value.i % 1000000);
          break;
        case "1217":
          m = moment.duration(value.i * 60 * 1000);
          break;
        case "1218":
          m = moment.duration(value.i * 1000);
          break;
        case "1219":
          m = moment.duration(value.i);
          break;
        default:
          m = moment.tz(value.i, "UTC");
          applyUserTimezone = true;
          break;
      }

      m.kdbType(value.class);
    } else {
      m = moment.tz(value, "UTC");
    }

    if (applyUserTimezone && this.timezone && m.isValid()) {
      (m as moment.Moment).tz(this.timezone);
    }

    return m;
  }

  static times(num: number, callback: (i: number) => any): any[] {
    const ret = [];
    for (let i = 0; i < num; i++) ret.push(callback(i));
    return ret;
  }

  static extractNanos(value: string): number {
    let nanos = 0;
    let regexResult;

    if (value) {
      if (typeof value.toString === "function") {
        value = value.toString();
      }

      regexResult = value.match(/\d{1,2}:\d{2}:\d{2}\.\d{3}(\d{6})/);

      if (regexResult) {
        nanos = Number(regexResult[1]);
      }
    }

    return nanos;
  }

  static htmlEncode(value: any): string {
    return value
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
