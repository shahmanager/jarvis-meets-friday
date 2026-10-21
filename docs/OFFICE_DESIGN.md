# Office design notes

21 October 2026 redesign ("night shift"): one token system with dark (default when the OS prefers dark) and light ("day shift") themes, chosen with the top-bar toggle and remembered per browser (`public/theme.js`, guarded storage). `style.css` holds tokens and components, `office.css` the scene, `cloud.css` the cloud console. Role colour is the only accent: ice `#7cd9ea` = Jarvis, copper `#f3a55b` = Friday; green/red mean state only. Chart series use separate tokens validated for contrast and colour-vision separation in both themes (`--series-1/2`). Type: Bricolage Grotesque (UI and display), Pixelify Sans (wordmark only), JetBrains Mono (machine values such as PoP codes, IDs and byte counts). The HUD layer and shared-workspace core are visible again in both themes. All element IDs used by `app.js` are unchanged; motion stays transform/opacity-only and stops under `prefers-reduced-motion`. See [cloud console](CLOUD_CONSOLE.md).

20 October output-fix pass: the original workshop and original 2D sprites are retained. Further redesign/image generation was stopped at the owner’s request. The targeted changes are a light contrast pass, system UI typography, visible root-mission list, concise real-state desk previews, bounded mission headings with the full request in a disclosure, Markdown rendered with DOM nodes, an adjustable work panel, and full-size HTML/PDF preview. Resize also supports keyboard arrows/Home/End. Native PDF rendering was checked in Chrome against an actual cloud artifact. HTML remains script-free in an isolated preview; app-owned design guidance uses semantic HTML, inline CSS and native disclosure controls. No generated illustrations are shipped.


20 October 2026 update: a suit-interface layer now surrounds the miniature workshop. Jarvis uses ice cyan `#79e4f4`; Friday uses copper/gold `#ffb468`; the shared mission console uses gold `#f0bf75` over deep navy `#0a1420`. This is an original interface inspired by their screen identities, with the existing licensed pixel characters retained. Space Grotesk now carries the wordmark too.

`public/office.css` contains the visual layer: dark mission pad, luminous role plaques, holographic station rings, arc-core centerpiece, hover beams and a subtle floor grid. The core orbit is decorative ambient motion. Station motion follows the existing persisted `.working` state; the connector animates only while a task is `waiting_peer`, representing a pending handoff rather than network telemetry. Approval/failure states receive a warm warning border and keep their text labels. All added animations and transitions stop under `prefers-reduced-motion`.

Validation: typecheck, 53 unit tests, build and office integration passed. Chrome checks used an isolated synthetic task fixture with no credentials/model requests: desktop, narrow phone layout, desk-to-work-panel navigation and keyboard focus. The fixture is not production task evidence. No backend, model, deployment topology or permission policy changed.

15 October 2026. Direction: an after-hours miniature workshop. The office stays the whole application; assign work from its command pad, inspect either desk, review results in the work panel, configure integrations only in Settings.

The two agents' complementary work becomes a single cutaway room: Jarvis's execution desk, Friday's library, a shared table. A dusk window, desk lamps, books and a sleeping cat provide texture and depth without pretending to be live integrations. The workshop illustration is original SVG; existing licensed pixel characters stay interactive HTML buttons over it.

Palette: night `#171f30`, slate `#242f43`, paper `#f0e9dc`, amber `#efc482`, sage `#a4c0b0`, clay `#e2a59a`. Space Grotesk carries app text; Pixelify Sans gives the wordmark its game-like character. Both fonts are self-hosted under OFL; no font CDN or new JavaScript dependency.

Interaction: desk hover/focus reveals real recent conversation, clicking opens the transcript. The activity note opens the real task. The library hotspot opens Laptop settings; the shared table selects Together and focuses the composer without submitting. Explicit Send mission remains the only dispatch control. Touch users can use desks and Settings without hover. Keyboard focus returns from the work panel; native Settings dialog traps focus.

Motion follows the [Vercel animation skill](https://github.com/vercel-labs/open-agents/blob/main/.agents/skills/web-animation-design/SKILL.md): short transform/opacity transitions, purposeful feedback, reduced-motion alternatives. Typing sprites are tied to persisted working state. No invented progress, character wandering or forced animation on every poll. The [Taste existing-project redesign skill](https://github.com/leonxlnx/taste-skill/blob/main/skills/redesign-skill/SKILL.md) guided layout, type, surfaces and state preservation. The repository's main Taste skill explicitly excludes app screens, so its landing-page generator was not used.

| Before | After |
| --- | --- |
| Repeated flat tiles and two matching rooms | One original cutaway workshop with shared furniture, dusk lighting and distinct work areas |
| Generic room plaques and broad empty canvas | Deliberate type hierarchy, real activity note and clear mission pad |
| Abrupt panel entry | 220ms ease-out panel/modal entry; immediate keyboard focus |
| Hover-only decorative emphasis | Desk focus reveals the same preview; touch opens real work directly |
| Existing bob used layout-changing margin | Transform-only sprite motion; every added animation/transition disabled under reduced motion |

The scene is decorative; task state, names, controls and conversations remain semantic HTML. Do not encode capability, connection or permission only in the artwork. Preserve no-overflow, visible focus, narrow-screen access, safe error states and original task API behavior when evolving the scene.
