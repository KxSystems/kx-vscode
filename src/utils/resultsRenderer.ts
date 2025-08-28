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

import { GridOptions } from "ag-grid-community";

import { ext } from "../extensionVariables";
import { isBaseVersionGreaterOrEqual } from "./core";
import { decodeQUTF } from "./decode";
import { StructuredTextResults } from "../models/queryResult";

export function convertToGrid(
  results: any,
  isInsights: boolean,
  connVersion?: number,
  isPython?: boolean,
): GridOptions {
  let rowData = [];
  let columnDefs = [];

  if (
    (!isInsights && !isPython) ||
    /* TODO: Workaround for Python structuredText bug */
    (!isPython && connVersion && isBaseVersionGreaterOrEqual(connVersion, 1.12))
  ) {
    rowData = updatedExtractRowData(results);
    columnDefs = updatedExtractColumnDefs(results);
  } else {
    results = isInsights ? (results.data ?? results) : results;
    const queryResult = isInsights ? results.rows : results;

    if (Array.isArray(queryResult[0])) {
      if (typeof queryResult[0][0] === "object") {
        rowData = queryResult[0].map((_, index) => {
          const row: any = {};

          queryResult.forEach((subArray: any[]) => {
            Object.assign(row, subArray[index]);
          });
          return row;
        });
      } else {
        rowData = queryResult.map((element: any) => ({ value: element }));
      }
    } else {
      rowData = queryResult;
    }

    rowData = rowData.map((row: any) => {
      const newRow = { ...row };

      Object.keys(newRow).forEach((key) => {
        if (typeof newRow[key] === "object" && newRow[key] !== null) {
          newRow[key] = newRow[key].toString();
        }
      });
      return newRow;
    });

    if (isInsights) {
      results.rows = rowData;
    }

    columnDefs = generateCoumnDefs(results, isInsights);
  }

  if (
    !columnDefs.some(
      (col: any) => col.field.toString().toLowerCase() === "index",
    )
  ) {
    rowData = rowData.map((row: any, index: any) => ({
      index: index + 1,
      ...row,
    }));
    columnDefs.unshift({
      field: "index",
      headerName: "Index",
      cellDataType: "number",
    });
  }

  if (rowData.length > 0) {
    ext.resultPanelCSV = convertToCsv(rowData).join("\n");
  }

  const gridOptions: GridOptions = {
    rowData: rowData,
    columnDefs: columnDefs,
  };

  return gridOptions;
}

export function updatedExtractRowData(results: StructuredTextResults) {
  const { columns } = results;
  const columnsArray = Array.isArray(columns) ? columns : [columns];

  let dataLength = 0;

  if (columnsArray.length > 0) {
    const firstColumnValues = columnsArray[0].values;

    if (Array.isArray(firstColumnValues)) {
      dataLength = firstColumnValues.length;
    } else {
      dataLength = 1;
    }
  }

  const rowData: { [key: string]: any }[] = Array.from(
    { length: dataLength },
    () => ({}),
  );

  columnsArray.forEach((column) => {
    const { name, values } = column;
    const valuesArray = Array.isArray(values) ? values.flat() : [values];

    valuesArray.forEach((value, index) => {
      rowData[index][name] = decodeQUTF(value);
    });
  });

  return rowData;
}

export function updatedExtractColumnDefs(results: StructuredTextResults) {
  const { columns } = results;
  const columnsArray = Array.isArray(columns) ? columns : [columns];
  const columnDefs = columnsArray.map((column) => {
    const sanitizedKey = sanitizeString(column.name);
    const cellDataType = kdbToAgGridCellType(column.type);
    const headerName = column.type
      ? `${sanitizedKey} [${column.type}]`
      : sanitizedKey;

    return {
      field: column.name,
      headerName: headerName,
      cellDataType,
      cellRendererParams: { disabled: cellDataType === "boolean" },
    };
  });

  return columnDefs;
}

export function sanitizeString(value: any): any {
  if (value instanceof Array) {
    value = value.join(" ");
  }
  if (!isNaN(value)) {
    return value;
  }
  value = value.toString();
  value = value.trim();
  value = value.replace(/['"`]/g, "");
  value = value.replace(/\$\{/g, "");
  return value;
}

export function kdbToAgGridCellType(kdbType: string): string {
  const typeMapping: { [key: string]: string } = {
    boolean: "boolean",
    booleans: "boolean",
    guid: "text",
    byte: "number",
    short: "number",
    real: "number",
    float: "number",
    char: "text",
    symbol: "text",
    string: "text",
    date: "text",
    time: "time",
    timestamp: "datetime",
    timespan: "text",
    minute: "text",
    second: "text",
    month: "text",
  };

  return typeMapping[kdbType.toLowerCase()] || "text";
}

export function generateCoumnDefs(results: any, isInsights: boolean): any {
  if (isInsights) {
    if (results.rows.length === 0) {
      return Object.keys(results.meta).map((key: string) => {
        const sanitizedKey = sanitizeString(key);
        const type = results.meta[key];
        const headerName = type ? `${sanitizedKey} [${type}]` : sanitizedKey;
        const cellDataType = kdbToAgGridCellType(type);

        return {
          field: sanitizedKey,
          headerName,
          cellDataType,
        };
      });
    } else {
      return Object.keys(results.rows[0]).map((key: string) => {
        const sanitizedKey = sanitizeString(key);
        const type = results.meta[key];
        const headerName = type ? `${sanitizedKey} [${type}]` : sanitizedKey;
        const cellDataType =
          type != undefined ? kdbToAgGridCellType(type) : undefined;

        return {
          field: sanitizedKey,
          headerName,
          cellDataType,
        };
      });
    }
  } else {
    if (typeof results[0] === "string") {
      return results.map((key: string) => {
        const sanitizedKey = sanitizeString(key);
        const cellDataType = "text";

        return {
          field: sanitizedKey,
          headerName: sanitizedKey,
          cellDataType,
        };
      });
    }
    return Object.keys(results[0]).map((key: string) => {
      const sanitizedKey = sanitizeString(key);
      const cellDataType = "text";

      return { field: sanitizedKey, headerName: sanitizedKey, cellDataType };
    });
  }
}

export function formatResult(queryResult: string | number): string {
  return queryResult !== ""
    ? `<p class="results-txt">${queryResult.toString().replace(/\n/g, "<br/>")}</p>`
    : "<p>No results to show</p>";
}

export function convertToCsv(data: any[]): string[] {
  const keys = Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((obj) => {
    return keys
      .map((key) => {
        return obj[key];
      })
      .join(",");
  });

  return [header, ...rows];
}
