# Issue 5377 visual evidence

These screenshots render Maka’s production CommandPalette with the production buildCommandList for zh-TW, in the existing Command Search Storybook frame. The local capture substitutes derived commands for the story’s hardcoded fixture; the substitution is not part of the fix.

Before: main 27add3049. After: fix/5377-traditional-chinese-commands.
Chrome, macOS arm64, 1100 × 760, light theme; animations disabled during capture.

The changes shown are localized command labels/hints and settings-section names. No native Electron behavior is claimed by these browser captures.

Automated evidence prepared by OpenAI Codex for https://github.com/apache/maka/issues/5377.


Review follow-up (2026-09-16): current production builder now reads settings navigation labels directly. Chrome queries `遠端串接`, `聯網搜尋`, `側聊`, and `追問` return the corresponding commands. `after-settings.png` has been refreshed and the three targeted search screenshots plus `review-browser.json` record the results. The existing Storybook fixture was temporarily populated from the real builder and restored after capture. Generated-by: OpenAI Codex.
