# BSP Auto Tools – Bookmarklets (Public)

Repo für die öffentliche Drag-&-Drop-Seite mit Bookmarklets.

- Lege Tools als einzelne Dateien in `src/` ab.
- `build.js` generiert `dist/index.html`.
- GitHub Pages: Source = GitHub Actions.

## Hinweis zu `_meta.json`

Falls das Build-Skript unerwartet mit einem JSON-Parse-Fehler abbricht, liegt die Ursache
häufig an einer `_meta.json`, die mit Windows-Zeilenenden (`CRLF`) oder einem UTF-8-BOM
gespeichert wurde. Vor der aktuellen Korrektur blieben dabei unsichtbare Steuerzeichen in
der bereinigten Datei zurück, sodass `JSON.parse` nicht den vollständigen Inhalt lesen
konnte. `build.js` normalisiert die Datei inzwischen automatisch auf `LF` und entfernt ein
eventuell vorhandenes BOM, bevor Kommentare entfernt und die Daten geparst werden.
