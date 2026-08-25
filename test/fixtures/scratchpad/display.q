// An extract of the Insights scratchpad definitions the extension talks to,
// kept as the reference for what the display endpoint and the image websocket
// channel send back. Only the definitions the extension contracts with are
// reproduced; everything they are built out of stays in Insights.
//
// Not loaded by any test — the stand-in server in test/e2e/utils and the unit
// tests are written against the contract spelled out here:
//
//   - display caches the incoming requestID in web.requestID, and showImage
//     echoes that id back to every scratchpad client on the "image" channel,
//     as {format: "PNG", encoding: "base64", requestID, data}.
//   - a PNG result skips the requested return format: the byte vector is
//     converted with .Q.btoa, so structuredText callers get a base64 string
//     where they expect JSON.

\d .com_kx_edi

web.requestID: ""

// @overview
// Checks if the value passed in is a byte vector starting with the signature for a PNG.
// This can't be replaced with isQPNG because there are side-effects and overhead to casting
// some values to q, and some values will error when cast to q.
// The default value of None is required so that passing in :: isn't treated as a missing parameter.
//
// @param x {any} The value to check for a PNG
//
// @returns {boolean} 1b if the function was passed a PNG
isPykxPNG: .pykx.qeval["lambda x=None: (isinstance(x, kx.ByteVector) and len(x) >= 8 and bytes(x[:8].py()) == bytes.fromhex('89504e470d0a1a0a'))"];


// @overview
// Checks if the value passed in is a byte vector starting with the signature for a PNG.
//
// @param x {any} The value to check for a PNG
//
// @returns {boolean} 1b if the function was passed a PNG
isQPNG: {
    $[  type[x] ~ 4h;
        (8#x) ~ 0x89504e470d0a1a0a;
        0b]
    }

web.processPythonRequest: {[returnFormat; args]
    result: .pystruct.pEvaluate args`expression;
    
    // If the expression evaluates to a PNG, the full serialized byte string should be returned
    isPNG: isPykxPNG  result`data;
    if [isPNG;
        returnFormat: "serialized"];
    
    result: .pystruct.pFormat[returnFormat; args `sampleFn; args `sampleSize; result];

    // pFormat doesn't sample the data, to avoid truncating PNGs.
    // So if the response isn't a PNG, it must be sampled here.
    if [(returnFormat ~ "serialized") and not isPNG;
        result[`data]: .struct.sample[args `sampleFn; args `sampleSize] toTable result `data];

    result
    };

web.processQRequest: {[returnFormat; args]
    result: .com_kx_ediNoCoverage.evaluate . args `expression`context;
    if [result `error; :result];
    data: result`data;
    util.cacheLastQuery data;
    
    result[`data]: $[
        isQPNG data;
            // Return the byte string without sampling
            data;
        returnFormat ~ "serialized";
            // Converting to table in q does not produce much overhead. Fine to convert before sampling
            .struct.sample[args `sampleFn; args `sampleSize] toTable data;
        returnFormat ~ "text";
            .struct.toString data;
        returnFormat ~ "structuredText";
            .struct.toStructuredText[data;.struct.sample[args `sampleFn; args `sampleSize]];
            ];
    result
    }

display: {[request]
    // requestID is optional, but will be given a default value of "" by the HTTP server.
    // The most recent requestID is cached so websocket responses can be matched to a display request.
    if [`requestID in key request `rawData;
        web.requestID: request[`rawData;`requestID]]; 

    // The token expires after a few minutes, so this needs to be updated with each request
    web.cacheJWT request;

    // Cache each incoming audit-id, needs to be updated with each request if audit-id is changed upstream
    web.cacheAID request;

    api: {[request]
        .com_kx_jobs.handleTimeoutHeader[request `hdr];
        args: request `data;
        util.clearLastQuery[args `preserveLastQuery];
        if [args[`returnFormat] ~ "";
            args[`returnFormat]: $[args `isTableView; "serialized"; "text"]];
        if [not args[`returnFormat] in ("serialized";"text";"structuredText");
            : `error`errorMsg`data`memory`sessionID!(1b; i.mapCustomErrMsg["return format"]; ::; util.getMemory[]; sessionID)];
        returnFormat: args `returnFormat;
        lang:$[isPy:"python" ~ args `language;"python";"q"];
        fn: $[isPy; web.processPythonRequest; web.processQRequest];
        response: web.wrapResponse[returnFormat ~ "serialized"; fn; (returnFormat; args); lang; "scratch"];
        $[  isQPNG response`data;
                // PNG byte vectors get converted to base64 so they can be sent over JSON
                response[`data]: .Q.btoa response`data;
            args[`returnFormat] ~ "structuredText"; // and the result is not a PNG
                // Due to a design oversight, v1 of the display API returns structuredText results as a JSON string
                // instead of a dictionary, and this needs to be maintained to support old VSCode extension versions.
                response[`data]: .j.j response `data;
            // Else, do nothing. This is just here to satisfy the linter
                ];
        response
        };
    
    // web.authz returns a function projection that accepts a REST server
    // request to check the auth token and validate against the given role.
    web.authz[`display; api] request
    }


// @Overview
// Sends an image over websocket to all scratchpad clients on the "image" channel
//
// @param image {byte[]} A PNG
// @param options {null} Currently unused, but present to keep the public API extensible
//
// @return {null}
showImage: {[image; options]
    .com_kx_edi.util.sendWebsocketMessage["image"; (!) . flip (
        (`format;    "PNG");
        (`encoding;  "base64");
        (`requestID; web.requestID);
        // base64 encoding is used to send the image efficiently using JSON
        (`data;      .Q.btoa image))];
    }

