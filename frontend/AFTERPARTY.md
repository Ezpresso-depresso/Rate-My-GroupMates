# Afterparty

A local single-player 3D brawl appended to the original team awards page. The current member is the player;
every other member of `team.members` is a bot. This is not online multiplayer.
The game reads existing awards and never sends review writes or changes scores.

## Try it without a backend

On Windows, double-click `Start-Afterparty.cmd` in the repository root, or run it
from any PowerShell directory using its full path:

```powershell
& "C:\Users\ASUS\Rate-My-GroupMates\Start-Afterparty.cmd"
```

The CMD file invokes the PowerShell helper with a process-only execution-policy
override; it does not change machine or user settings. The launcher uses installed
Node, or the existing bundled Codex Node runtime when Node/npm are not on PATH.
It opens `http://127.0.0.1:5173/?start=1` after the server is ready, beginning with
the original member picker, then the original ratings and awards pages. The added
game remains optional at the bottom of awards. The `start=1` link clears only the
selected demo identity so you can begin with member selection again.
If this preview is already running, another launch reopens the same server. If a
different application owns the port, the launcher tries the next available port
and prints the actual URL. It never stops unrelated applications.

Keep the server window open while playing. Stop with Ctrl+C. If you closed it,
run the launcher again before refreshing the browser. Startup errors remain visible.
For a specific port, use the PowerShell helper with `-Port 5180`; use `-NoOpen`
for automated verification without launching a browser.

On a normal Node.js 24+ setup:

```sh
cd frontend
npm ci
npm run dev:afterparty
```

The launcher runs the original app against an in-memory demo API installed only
in its development server. A banner labels the fictional data. Selecting a member,
joining through the existing form, rating teammates, submitting, editing and
switching members use the original app components. Demo reviews survive page
refreshes but reset when the server restarts. Nothing connects to MongoDB or writes
real team reviews. Production config and original business source are unchanged.

The old awards-only developer preview remains at `/dev/afterparty.html`, but the
launcher no longer opens it. Its optional `?members=12` fixture is for game testing
only. The real game reads the team's full member list; it adds no member-count
selector. That preview HTML is excluded from the production build.

## Real team integration

Set `VITE_API_URL` and `VITE_TEAM_ID` in `frontend/.env.local` using a working test
backend and team, then restart Vite. `frontend.env` is not a Vite env filename;
the checked-in example currently contains placeholder values.

Complete the existing ratings, open Awards, then select **Enter Afterparty** at
the bottom. The optional game expands within `/awards`; closing it unmounts the
game while preserving every original award card and detail control. There is no
new route. Unsubmitted members see the original AwardsEmpty screen without the
game entry. The existing provider, member selection, review submission, award
rules, layout and backend are unchanged. Game code and Three.js are lazy-loaded
only when the extra entry is opened.

The only edit to existing application source is two added lines in
`src/pages/AwardsPage.tsx`: the `AfterpartyEntry` import and appended component.
Dependency and test configuration additions support this isolated feature.

## Controls and rules

| Control | Action |
| --- | --- |
| WASD / arrow keys | Move and face that direction |
| J / hold left mouse button in arena | Jab; successive jabs chain into a three-hit combo |
| K | Heavy punch with a longer visible windup |
| Space | Jump |
| Shift | Dash in facing direction, with brief invulnerability |
| Esc / Pause | Pause and resume |
| On-screen buttons | Touch movement, jump, dash and attacks |

Click the arena to focus keyboard controls. Other controls retain normal browser
keyboard behavior. Losing window focus or hiding the tab pauses the round;
returning does not automatically resume. Sound is opt-in.

- 100 HP; jabs deal 16 damage, third jabs 24, heavy punches 30.
- Attacks have windup, active and recovery phases. Facing, range, height and
  invulnerability all affect hit detection. Each swing can hit a target once.
- Stamina regenerates. Jabs cost 6, heavy punches 28, dashes 25.
- Fighters collide with one another, arena edges and four stage bumpers.
- AI periodically chooses a nearby target, including other bots, steers around
  bumpers and can dash away from a heavy windup. It does not read review scores.
- Knockouts award one KO; the defeated fighter respawns after 2.5 seconds in a
  safer perimeter location with two seconds of protection.
- Choose a 60, 90 or 120-second round. Rankings use KOs, then fewer deaths, then
  damage dealt. Exact ties share a rank. Replay resets the entire simulation.
- At least two members are required. The arena grows with group size; large
  groups are more expensive because collision and targeting checks are pairwise.

## Implementation

- `src/features/afterparty/engine.ts`: pure fixed-step simulation, AI, combat,
  collisions, phases and rankings; independent of React and Three.js.
- `scene.ts`: actual Three.js meshes, articulated procedural characters, lighting,
  shadows, animations, nameplates and hit particles. No external model downloads.
- `Game.tsx`: game loop, scoped input, focus handling, sound, HUD and controls.
- `AfterpartyEntry.tsx`: optional expansion appended to the original awards page.
- `AfterpartyPanel.tsx`: real member/award mapping and the expandable game lobby.

Each mounted game owns its renderer and simulation. Unmount removes listeners,
disconnects resize observation, stops the animation loop, closes audio and disposes
GPU geometry, materials, textures, shadows and renderer resources. WebGL failure
shows a retry/exit UI. Reduced-motion preferences remove confetti and extra bouncing.

## Verification

```sh
npm test
npm run test:launcher
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
```

To use installed Chrome instead of downloading Chromium, set
`PLAYWRIGHT_CHANNEL=chrome` (`$env:PLAYWRIGHT_CHANNEL='chrome'` in PowerShell).
Browser tests run a dedicated local server on port 5179 and intercept all API
requests. They cover submission gating, rating submission, member counts, movement,
pause/resume, touch controls, WebGL failure, a full round, replay, and navigation.
`test-results` and `playwright-report` are ignored.
Launcher tests cover repeat startup, restart after stopping, execution from a
different directory, and ports occupied by another application.
`node node_modules/@playwright/test/cli.js test --config playwright.demo.config.ts`
tests the complete original UI against the local demo API without intercepting API
requests: member selection, rating every teammate, saving, awards, the game, joining
and restarting from member selection.

Real database integration still needs a working test API URL and team ID. The
local preview and intercepted browser tests do not prove a remote database works.
This version uses procedural animation and lightweight collision rules, rather
than imported skeletal assets or ragdoll physics. It is a playable project feature,
not a recreation of the commercial Pummel Party game.
