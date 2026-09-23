# Insights scratchpad display protocol

The contract the extension talks to on an Insights connection. Nothing loads
this file — it is the reference the unit tests and the stand-in server in
`test/e2e/utils/insightsServer.ts` are written against. The definitions
themselves live in Insights.

## Display responses

`display` takes a `returnFormat` of `text`, `structuredText` or `serialized`,
and echoes the `requestID` it was given.

Any expression returning a byte vector that starts with the PNG signature
`0x89504e470d0a1a0a` ignores the requested return format: the vector is
converted with `.Q.btoa` and comes back as a base64 string, with no sampling
applied. So a `structuredText` caller gets a bare string where it otherwise
expects JSON, and a base64 PNG is the one result that is never truncated.

For a non-PNG result, `structuredText` returns the payload as a JSON *string*
rather than a dictionary. That is a design oversight in v1 of the API, kept for
older extension versions.

## Image websocket messages

`showImage` sends a PNG to every scratchpad client on the `image` channel,
tagged with the `requestID` cached from the most recent `display` request:

```json
{
  "channel": "image",
  "data": {
    "format": "PNG",
    "encoding": "base64",
    "requestID": "some guid",
    "data": "iVBORw0KGg... PNG as base64"
  }
}
```

Messages on any other channel — `logging` in particular — carry an unrelated
shape, so a client must dispatch on `channel` rather than assuming anything it
does not recognize is a log line.
