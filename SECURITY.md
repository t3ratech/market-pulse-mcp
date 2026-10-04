# Security policy

Report a vulnerability privately to **t3ratech.dev@gmail.com** with the subject
`market-pulse-mcp security`, or through GitHub's private vulnerability reporting on this
repository. Please do not open a public issue for it.

You can expect an acknowledgement within three working days. Fixes ship as a patch
release with a CHANGELOG entry crediting the reporter unless they ask otherwise.

Scope: this package (`src/`), its release artefacts and the agent skill. The hosted
Market Pulse service is reported through the same address.

Design properties the package commits to, each covered by a test: the API key is sent only
to the configured HTTPS origin and never appears in an error or log line; redirects are
refused; a non-Market-Pulse key is rejected at startup; oversized responses are refused;
the server reads no files and opens no ports.
