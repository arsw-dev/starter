# Changelog

## 0.1.1

`connect` takes `forward`, the names of headers to send from the request a
server function is handling to the API on every call. Only the named headers go,
one the incoming request lacks isn't sent, and a call's own header of the same
name wins. Without `forward`, nothing changes.

## 0.1.0

The first release: `connect` and its typed `call`, `ApiError`, `defineApi` with
a minimum time for queries and mutations, `createQueryClient`, `setupSsr` and
`startOptions`.
