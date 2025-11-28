# AEGIR-SITE
THE MAP AND SITE OF THE GAME

## Viewing the site locally

You can run a lightweight test server to see the pages (including the OTHER NEXI NEWS carousel) in your browser:

1. From the repository root, start the server:

   ```bash
   python -m http.server 8000 --bind 127.0.0.1
   ```

2. Open http://127.0.0.1:8000/interviews.html in your browser to view the carousel and other content.

Use `Ctrl+C` in the terminal to stop the server when you are done.

## Quick test run

You can confirm the static pages serve correctly by running a short-lived server session:

```bash
timeout 5s python -m http.server 8000 --bind 127.0.0.1
```

If the server starts without errors, the smoke test has passed.
