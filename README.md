# Breeze Cooling Solutions — Website

Public source code for a Breeze Cooling Solutions event-cooling website, including an interactive structural/cooling study.

## What's here

- `index.html`: page structure and content
- `styles.css`: styling
- `main.js`: navigation and enquiry form
- `build.js` and `structure.js`: interactive visualizations
- `assets/`: imagery and other website assets
- `vercel.json`: clean-URL and cache-header configuration

This is a static HTML/CSS/JavaScript site; no application build or database is required for local preview.

## Preview locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

The enquiry form prepares a WhatsApp message in the visitor's browser. It does not submit customer details to an application backend in this repository.

## Usage and licensing

**Public visibility does not automatically mean open-source licensing.** A source-code license has not yet been added to this repository. Before reusing or redistributing the code, obtain permission from the rights holder. Photos, logos, brand names, and other assets may require separate permission even if a code license is added later.

If you want to contribute, open an issue describing the proposed change.
