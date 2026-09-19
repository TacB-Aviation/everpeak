export function htmlDoc({ title, body, style = "", script = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
  :root {
    --bg: #0b0d12; --panel:#12151c; --panel2:#171b24; --border:#232733;
    --text:#e8eaf0; --muted:#9aa2b1; --accent:#5b8def; --accent2:#7c5cff;
    --danger:#ef5b5b; --success:#33c481; --radius:12px;
  }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: radial-gradient(circle at top, #151925, #05060a 70%); color: var(--text); min-height:100vh; }
  a { color: var(--accent); }
  button { font-family: inherit; cursor: pointer; }
  input, select, textarea { font-family: inherit; }
  ::selection { background: var(--accent2); color:#fff; }
  ${style}
</style>
</head>
<body>
${body}
<script>${script}</script>
</body>
</html>`;
}

export const securityHeaders = (extra = {}) => ({
  "Content-Type": "text/html; charset=UTF-8",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Cache-Control": "no-store",
  ...extra,
});
