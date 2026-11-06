# ApniRide: UI design spec

ApniRide is a ride-hailing app for Pakistan where **the rider names the price and drivers respond with offers**. This spec covers the 8 core screens. The working reference for every screen is in `../prototype/screens/*.html`; open them in a browser. All exact values are in `tokens.json`.

## 1. Look and feel

- **Mood:** bright, friendly, confident. Rounded shapes and a springy "bounce" on everything that enters the screen.
- **Colours:** royal blue `#1E40AF` is the brand colour. Sunshine yellow `#FFC83D` is the one accent. Ink `#14132B` is for text and dark CTAs. The background is a soft blue-white `#F2F5FC`.
- **Type:** *Bricolage Grotesque* (800) for headlines, prices and numbers. *Plus Jakarta Sans* for everything else.
- **Shapes:** pill buttons (fully rounded), 28–36 px card radius, 46 px round icon buttons.
- **Money format:** `Rs 450` (space after Rs, no decimals, thousands separator `Rs 6,850`).
- **Phone format:** `+92` fixed prefix, then `300 1234567`.
- **Login is mobile number + OTP only.** There are no Google/Apple/email options.

## 2. Reusable components

| Component | Spec |
|---|---|
| Primary CTA (dark) | 62 px tall, ink background, white 17/700 label left-aligned with 26 px padding, 48 px yellow circle on the right holding an arrow icon |
| Primary CTA (blue) | 60–62 px pill, `#1E40AF`, white 17/700 centred label |
| Outline button | 44–56 px pill, 2 px `#DDE3EF` border, white fill, ink 700 label |
| Icon button | 46–48 px circle, white (on light bg) or `rgba(255,255,255,.18)` (on blue) |
| Card | white, 28 px radius, 16–20 px padding |
| Hero card | blue `#1E40AF`, 32 px radius, white text |
| Chip / tag | 42–44 px pill. Off: white + `#DDE3EF` border. On: blue fill, white text |
| Route connector | blue dot (pickup) → dashed `#B7C8EE` line (animated) → coral rounded square (drop) |
| Bottom nav | floating 68 px ink pill; active tab = yellow pill with icon + label; others icon only |
| Avatar | circle, initials in Bricolage 800 on a tint colour |
| Countdown ring | 56 px, 5 px stroke, blue progress on `#EBEFF7` track, seconds in centre |

Icons are simple 2–2.6 px stroke line icons (any icon set with rounded caps works, e.g. Lucide).

## 3. Screens

### 3.1 Splash (`splash.html`)
- Full blue background. A yellow sun with slowly rotating rays rises up (1.4 s spring). Two white clouds drift.
- A darker blue road band crosses mid-screen with moving lane dashes. A yellow car drives across in a loop, with spinning wheels and a small up-down bob.
- Bottom: wordmark **ApniRide.** (the dot is yellow), tagline *"Fair rides, on your terms. You set the price — drivers say yes."* ("your" is highlighted in a yellow pill).
- CTA "Let's ride" (white pill with yellow arrow circle) → Login. Text link "Become a driver" → Driver mode.
- Wordmark, tagline and buttons bounce in, staggered 0.6 / 0.75 / 0.9 / 1.0 s.

### 3.2 Login: phone + OTP (`login.html`)
- Blue top area with a floating phone illustration and a yellow speech bubble that pops in showing the code.
- White bottom sheet (40 px top radius) slides up.
- "Hey there!" / "Log in with your phone — takes 10 seconds."
- Phone field: pill, `+92` prefix, divider, number input, green check circle when valid.
- OTP: 4 circles. Filled digits are blue circles with white numbers and pop in one by one (spring). The empty slot has a dashed blue outline and a blinking caret.
- Custom number pad (3 × 3, 42 px keys, scale to 0.9 on press). Add 0 and backspace in the real app.
- CTA "Continue" → Home. **No social login.**

### 3.3 Home (`home.html`)
- Header: avatar (yellow), "Good morning" + "Where to, Ahmed?", and a notification bell with a red dot.
- Map card (230 px, 32 px radius): light map, cars moving along roads, and a bouncing blue location pin with a squashing shadow.
- Floating search pill inside the bottom of the map card: "Search destination" plus a blue arrow circle → Offer your fare.
- 2 × 2 service tiles: **Ride** (blue), **Moto** (yellow), **Rickshaw** (white), **Intercity** (white). Each has an icon and a subtitle. The icon wiggles on press/hover.
- Recent places card: Emporium Mall, Office (Arfa Software Technology Park).
- Floating ink bottom nav: Home (active), Trips, Wallet, Profile.
- Everything pops in with a 70–100 ms stagger.

### 3.4 Offer your fare (`fare.html`): **core inDrive mechanic**
- Route card: From / To, distance + ETA.
- Blue hero card: "Your offer" + fair range (Rs 420–490). The big price is Bricolage 76 px and does a **jelly bounce** on every change.
- Slider (Rs 250 – Rs 750, step 10) with a yellow thumb. Quick buttons: −Rs 20, +Rs 20, +Rs 50.
- "Acceptance meter" card: 4 car icons light up blue as the price rises, with a matching message:
  - < 380: "Few drivers may accept"
  - 380–419: "Some drivers will accept"
  - 420–489: "Most drivers will accept"
  - ≥ 490: "Drivers will rush to you"
- Payment pill (Cash · JazzCash) and "+ Comment".
- CTA "Send offer to drivers" → Driver offers.

### 3.5 Driver offers (`offers.html`)
- Header pill shows the rider's offer.
- "3 offers in!" with a pulsing yellow radar icon and 3 hopping dots ("More coming").
- **Stacked card deck:** two tinted cards peek behind the active card. The active card **deals in** (slides up from below with a slight rotation and a spring).
- Card content: avatar, name, rating, trips; a 20 s countdown ring; car and arrival time tiles; yellow price strip with a note ("Accepted your price" / "Counter-offer" / "Lower than yours").
- Actions: ✕ skip (round outline button) and "Ride with {first name}" (blue pill) → Live trip.
- When the timer hits 0, or on skip, the next card deals in. Pager dots below (the active one is wide and blue).

### 3.6 Live trip (`trip.html`)
- Full map. The blue route draws itself (2 s). A yellow car moves along the route path. A coral destination pin.
- Top: back button and a red **SOS** pill.
- Floating white sheet (36 px radius, inset 12 px) slides up:
  - "Arriving in **3 min**" + pulsing green live dot
  - 4-step progress bar: Assigned → On the way → Picked up → Arrived (fills with an animation)
  - Driver row: avatar, name, rating, car, plus Chat and Call buttons
  - Tiles: number plate (LEA 4821) and a dark **Ride PIN** tile whose yellow digits flip in one by one
  - Outline button: "Rs 450 · Cash/JazzCash · Share live trip"

### 3.7 Trip complete (`rate.html`)
- Blue header with rounded bottom; confetti pieces fall in a loop; the yellow check badge bounces in.
- "Woohoo, you're here!" / "Paid Rs 450 via JazzCash · 24 min ride".
- Rating card: **5 face buttons** (sad → very happy). The selected face scales to 1.18 and gets a colour (red, orange, grey, green, yellow), and the word below updates.
- "What stood out?" toggle chips (multi-select).
- CTA "Submit & go home".

### 3.8 Driver mode (`driver.html`)
- Header "Ready, Bilal?" + a "Rider mode" switch pill.
- Earnings card: animated goal ring (fills to 68%), today's earnings (Rs 6,850), trips and rating chips.
- Dark status card: green power button with pulsing rings, "You're online", demand hint.
- **Incoming request sheet** springs up from the bottom with a blue border:
  - Yellow countdown bar (15 s)
  - Badge "New request · 1.2 km away", rider name + rating, "Rider offers **Rs 1,200**"
  - Route: DHA Phase 5 → Allama Iqbal Airport · 18 km · 35 min
  - Counter-offer pills: Rs 1,300 / 1,400 / 1,500
  - CTA "Accept for Rs 1,200"

## 4. User flow

```
Splash ─▶ Login (phone → OTP) ─▶ Home ─▶ Offer your fare ─▶ Driver offers ─▶ Live trip ─▶ Trip complete ─▶ Home
   └──▶ Driver mode (incoming request → accept / counter-offer)
```

## 5. Motion rules

- **Enter:** elements pop/bounce in with `cubic-bezier(.2,.9,.3,1.3)`, 600–800 ms, staggered by about 70 ms.
- **Sheets:** slide up with `cubic-bezier(.2,.9,.25,1.05)`, 800 ms.
- **Feedback:** buttons scale to 0.9–0.94 on press. Changed numbers do a short jelly bounce.
- **Ambient loops** (keep them subtle): car on map, pin bounce, radar pulse, live dot, dashed route flow.
- **Respect "reduce motion":** turn off loops and use simple fades.
- Implementation suggestions: React Native → Reanimated + `react-native-svg` (route drawing via `strokeDashoffset`). Flutter → implicit animations + `flutter_animate`, `CustomPainter` for routes. Lottie is optional for the splash car.

## 6. Accessibility

- Text contrast meets WCAG AA (white on `#1E40AF` ≈ 8.7:1; `#5B5A72` on `#F2F5FC` ≈ 6.1:1). Never put white text on yellow; use ink.
- Touch targets ≥ 44 px.
- Icon-only buttons need labels (Back, Call, Chat, Skip offer, SOS).
- Don't rely on colour alone: selected chips change fill **and** text colour.

## 7. Placeholder content

All names, places, prices, plate numbers and the "JazzCash" payment label are sample data for the mockups. Replace them with real data from your backend.
