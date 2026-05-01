# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Settings export/import (#113). Two buttons on the Settings page bundle server config, browser localStorage, and opted-in plugin server-side files into a single versioned JSON file for backup, migration, or sharing a calibrated setup. Server-side import is all-or-nothing for safety-critical failures: phase-1 validates the entire bundle (schema, path-traversal, encoding) before any disk writes; phase-2 commits each file via temp+rename. Plugin-state mismatches between export and import are handled leniently: files referenced for a plugin that isn't loaded are skipped with a warning, files referenced for a plugin whose manifest no longer declares them are skipped with a warning, and localStorage is merged (not cleared) so first-run defaults from plugins installed after the export are preserved. Path-traversal, absolute paths, schema mismatch, and decode failures remain hard refusals. Plugins opt their server-side files in by declaring `settings.server_files` in `plugin.json` (list of relpaths under `CONFIG_DIR`; trailing `/` denotes a directory).

### Changed
- Settings page restructured into separate "Slopsmith" (core) and "Plugins" sections, with each plugin's settings rendered as a collapsible panel (collapsed by default). "Plugin Updates" moved into the Plugins section.

## [0.2.4] - 2026-04-22

### Added
- Version badge in navbar (`/api/version` endpoint + `VERSION` file)
- `CHANGELOG.md` and semantic versioning
- Step Mode plugin
- `gp2midi` improvements and expanded test coverage
- Note Detection plugin factory-pattern refactor with multi-instance/splitscreen support
- Per-panel note detection in Split Screen plugin with M/L/R channel routing for multi-input interfaces

### Fixed
- `SLOPPAK_CACHE_DIR` moved to `CONFIG_DIR` for AppImage compatibility
- Improved error message when plugin requirements fail to install
