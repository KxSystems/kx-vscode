import { validateUtils } from "../utils/validateUtils";

export function validateServerAlias(
  input: string | undefined
): string | undefined {
  // server alias is not required, but should be validated if entered
  if (input !== undefined && input !== "") {
    if (input[0] === " ") {
      return "Input value cannot start with a space.";
    }
    if (!validateUtils.isValidLength(input, 1, 64)) {
      return "Input value must be between 1 and 64 alphanumeric characters in length.";
    }
    if (!validateUtils.isAlphanumericWithHypens(input)) {
      return "Input value must contain only alphanumeric characters and hypens only";
    }

    if (input === "InsightsEnterprise") {
      return "Input value using restricted keywords of Insights Enterprise";
    }
  }
  return undefined;
}

export function validateServerName(
  input: string | undefined
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isValidLength(input, 1, 64)) {
      return "Input value must be between 1 and 64 alphanumeric characters in length.";
    }
  }
  return undefined;
}

export function validateServerPort(
  input: string | undefined
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isNumber(input)) {
      return "Input value must be a number.";
    }
    const parsedNumber = Number(input);
    return parsedNumber > 0 && parsedNumber < 65536
      ? undefined
      : "Invalid port number, valid range is 1-65536";
  }
  return undefined;
}

export function validateServerUsername(
  input: string | undefined
): string | undefined {
  if (input !== undefined && input !== "") {
    if (!validateUtils.isValidLength(input, 1, 64)) {
      return "Input value must be between 1 and 64 alphanumeric characters in length.";
    }
  }
  return undefined;
}

export function validateServerPassword(
  input: string | undefined
): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isValidLength(input, 1, 64)) {
      return "Input value must be between 1 and 64 alphanumeric characters in length.";
    }
  }
  return undefined;
}

export function validateTls(input: string | undefined): string | undefined {
  if (input !== undefined) {
    if (!validateUtils.isBoolean(input)) {
      return "Input value must be a boolean (true or false)";
    }
  }
  return undefined;
}
