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
import Tools from "./tools";

function stringifyTemporal(
  temporal: DDateClass | DDateTimeClass | DMonthClass,
  stringify: () => string,
): string {
  const i = temporal.i;

  if (typeof i === "number" && !isNaN(i)) {
    if (i === Number.POSITIVE_INFINITY) {
      return "Infinity";
    } else if (i === Number.NEGATIVE_INFINITY) {
      return "-Infinity";
    } else {
      return stringify();
    }
  } else {
    return "";
  }
}

export class DTimestampClass {
  public class!: string;
  i: number;
  n: number;

  constructor(i: number, n: number) {
    this.i = i;
    this.n = n;
  }

  toDate(): moment.Moment {
    return Tools.convertKDBTemporalToMoment(this) as moment.Moment;
  }

  toString(): string {
    return this.toDate()
      .formatNano("YYYY-MM-DD HH:mm:ss.SSSSSSSSS")
      .replace(" ", "D");
  }
}
export class DMonthClass {
  public class!: string;
  i: number;

  constructor(i: number) {
    this.i = i;
  }

  toDate(): moment.Moment {
    return Tools.convertKDBTemporalToMoment(this) as moment.Moment;
  }

  toString(): string {
    return stringifyTemporal(this, () => this.toDate().format("YYYY-MM"));
  }
}

export class DDateClass {
  public class!: string;
  i: number;
  n?: number;

  constructor(i: number, n?: number) {
    this.i = i;
    this.n = n;
  }

  toDate(): moment.Moment {
    return Tools.convertKDBTemporalToMoment(this) as moment.Moment;
  }

  toString(): string {
    return stringifyTemporal(this, () =>
      moment(new Date(this.i)).utcOffset(0).format("YYYY-MM-DD"),
    );
  }
}

export class DDateTimeClass {
  public class!: string;
  i: number;

  constructor(i: number) {
    this.i = i;
  }

  toDate(): moment.Moment {
    return Tools.convertKDBTemporalToMoment(this) as moment.Moment;
  }

  toString(): string {
    return stringifyTemporal(this, () =>
      this.toDate().format("YYYY-MM-DD HH:mm:ss.SSS").replace(" ", "T"),
    );
  }
}

export class DTimespanClass {
  public class!: string;
  i: number;

  constructor(i: number) {
    this.i = i;
  }

  toDate(): moment.Duration {
    return Tools.convertKDBTemporalToMoment(this) as moment.Duration;
  }

  toString(): string {
    return this.toDate().formatNano();
  }
}

export class DMinuteClass {
  public class!: string;
  i: number;
  n: number;

  constructor(i: number) {
    this.i = i;
    this.n = 0;
  }

  toDate(): moment.Duration {
    return Tools.convertKDBTemporalToMoment(this) as moment.Duration;
  }

  toString(): string {
    return this.toDate().format("HH:mm", { trim: false });
  }
}

export class DSecondClass {
  public class!: string;
  i: number;

  constructor(i: number) {
    this.i = i;
  }

  toDate(): moment.Duration {
    return Tools.convertKDBTemporalToMoment(this) as moment.Duration;
  }

  toString(): string {
    return this.toDate().format("HH:mm:ss", { trim: false });
  }
}

export class DTimeClass {
  public class!: string;
  i: number;

  constructor(i: number) {
    this.i = i;
  }

  toDate(): moment.Duration {
    return Tools.convertKDBTemporalToMoment(this) as moment.Duration;
  }

  toString(): string {
    return this.toDate().format("HH:mm:ss.SSS", { trim: false });
  }
}

// annotate clases
DTimestampClass.prototype.class = "1212";
DMonthClass.prototype.class = "1213";
DDateClass.prototype.class = "1214";
DDateTimeClass.prototype.class = "1215";
DTimespanClass.prototype.class = "1216";
DMinuteClass.prototype.class = "1217";
DSecondClass.prototype.class = "1218";
DTimeClass.prototype.class = "1219";
