
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace validateUtils {
  export function isValidLength(value: string, lower?: number, upper?: number): boolean {
    const maxInteger = 2147483647;

    lower ??= 1;
    upper = !upper || upper > maxInteger ? maxInteger : upper;

    if (lower > upper || value.length < lower || value.length > upper) {
      return false;
    } else {
      return true;
    }
  }

  export function isAlphanumericWithHypens(value: string): boolean {
    return /^[a-zA-z0-9]([-a-zA-z0-9]*[a-zA-z0-9])?$/.test(value);
  }

  export function isLowerCaseAlphanumericWithHypens(value: string): boolean {
    return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value);
  }

  export function isNumber(value: string): boolean {
    if (value !== undefined && !Number.isNaN(Number(value))) {
      return true;
    }
    return false;
  }
}
