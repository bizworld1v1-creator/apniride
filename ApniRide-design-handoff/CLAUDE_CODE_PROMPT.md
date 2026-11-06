# Prompt to paste into Claude Code

Copy this folder into your project repo (for example as `design/ApniRide-design-handoff/`), open Claude Code in the repo, then paste one of the prompts below.

---

## Prompt 1: UI review (do this first)

```
I'm building ApniRide, a ride-hailing app for Pakistan (inDrive-style: the rider names the fare and drivers send offers).
The new UI design is in design/ApniRide-design-handoff/:
- design/DESIGN_SPEC.md  → full screen-by-screen spec, components, motion and accessibility rules
- design/tokens.json     → exact colours, fonts, radii, spacing, shadows, easing curves
- prototype/screens/*.html → working HTML/CSS reference for all 8 screens (open in a browser)

Please:
1. Read the spec, tokens and all 8 prototype screens.
2. Look at my existing app code and tell me what stack and UI structure I currently have.
3. Review the design against my app: list which of my current screens map to which design screen, what's missing,
   and any UX, accessibility or technical problems you see in the design.
4. Propose an implementation plan (theme/tokens first, then shared components, then screens in flow order),
   and say which animation libraries you'd use for my stack.
Do not change any code yet. Wait for my approval of the plan.
```

## Prompt 2: Implementation (after you approve the plan)

```
Implement the ApniRide UI from design/ApniRide-design-handoff/ following the plan we agreed.
Rules:
- Put every value from design/tokens.json into a single theme file. No hard-coded colours or font sizes in screens.
- Build the shared components first (Primary CTA, outline button, icon button, card, chip, route connector,
  bottom nav, avatar, countdown ring), then the screens in flow order:
  Splash → Login (phone + OTP only, NO Google/Apple/email login) → Home → Offer your fare → Driver offers
  → Live trip → Trip complete → Driver mode.
- Match the prototype HTML visually, including the animations listed in DESIGN_SPEC.md section 5,
  and respect the OS reduce-motion setting.
- Currency format "Rs 450", phone prefix +92.
- Keep my existing business logic and API calls; only replace the UI layer. Where the design needs data I don't have yet,
  use clearly marked mock data.
- After each screen, run the app/tests and show me what changed before moving on.
```

---

Tip: if your app is React Native or Flutter, tell Claude Code that in the first line so it reads the prototype as a visual reference and doesn't try to copy the HTML directly.
