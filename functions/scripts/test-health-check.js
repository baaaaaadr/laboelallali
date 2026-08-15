/**
 * Unit-drives the PURE health-check state machine (lib/monitoring/stateMachine.js)
 * with scripted probe sequences and asserts the alerting contract:
 *   - steady up → no email;
 *   - up → down → exactly ONE down alert;
 *   - long outage → 0 extra emails until +6 h → exactly one reminder;
 *   - down → up → recovery (once);
 *   - a failed send is retried on the next check (downAlertPending);
 *   - flap dedup (30-min window).
 *
 * Requires a build first (npm run build) so lib/ exists. No network, no Firebase.
 *   node scripts/test-health-check.js
 * Exits non-zero on the first failed assertion.
 */
const path = require("path");
const FN_DIR = path.join(__dirname, "..");
const {
  classifyProbe,
  evaluate,
  defaultState,
  ALERT_DEDUP_MS,
  REMINDER_EVERY_MS,
} = require(path.join(FN_DIR, "lib/monitoring/stateMachine"));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  }
}
function actionTypes(ev) {
  return ev.actions.map((a) => a.type);
}

/** Apply an evaluation's patch on top of a state (mimics the Firestore merge). */
function applyPatch(state, patch) {
  return { ...state, ...patch };
}

const MIN = 60 * 1000;
const DOWN_SERVER = classifyProbe({ kind: "server", status: 523 });
const DOWN_CONFIG = classifyProbe({ kind: "unauthorized", status: 401 });
const UP = classifyProbe(null);

// ── classifyProbe ─────────────────────────────────────────────────────────────
console.log("classifyProbe");
assert(classifyProbe(null).up === true, "success → up");
assert(classifyProbe({ kind: "not_found", status: 404 }).up === true, "404 → up (server answered)");
assert(classifyProbe({ kind: "rate_limited", status: 429 }).up === true, "429 → up");
assert(classifyProbe({ kind: "network" }).up === false, "network → down");
assert(classifyProbe({ kind: "network" }).reason === "server", "network → reason server");
assert(classifyProbe({ kind: "server", status: 522 }).reason === "server", "522 → reason server");
assert(classifyProbe({ kind: "server", status: 523 }).reason === "server", "523 → reason server");
assert(classifyProbe({ kind: "unauthorized", status: 401 }).reason === "config", "401 → reason config");
assert(classifyProbe({ kind: "weird" }).reason === "config", "unknown kind → reason config");

// ── steady up → heartbeat only ────────────────────────────────────────────────
console.log("steady up");
{
  let s = { ...defaultState(), up: true };
  const ev = evaluate(s, UP, 1000);
  assert(ev.actions.length === 0, "up→up emits no action");
  assert(ev.patch.lastOkAt === 1000 && ev.patch.lastCheckAt === 1000, "up→up updates heartbeat");
}

// ── up → down → single alert, committed-before-send retry ─────────────────────
console.log("up → down");
{
  let t = 10 * MIN;
  let s = { ...defaultState(), up: true, since: 0, lastOkAt: 0 };
  const ev = evaluate(s, DOWN_SERVER, t);
  assert(ev.patch.up === false, "transition sets up=false");
  assert(ev.patch.downSince === t, "downSince stamped");
  assert(ev.patch.downAlertPending === true, "downAlertPending set (before send)");
  assert(actionTypes(ev).includes("alert_down"), "emits alert_down");
  const a = ev.actions.find((x) => x.type === "alert_down");
  assert(a.reason === "server", "alert carries reason server");

  // Simulate the send SUCCEEDING → plumbing clears pending + stamps lastDownAlertAt.
  s = applyPatch(s, ev.patch);
  s = applyPatch(s, { downAlertPending: false, lastDownAlertAt: t });

  // Next check 5 min later, still down → NO new alert (dedup + not pending).
  const ev2 = evaluate(s, DOWN_SERVER, t + 5 * MIN);
  assert(ev2.actions.length === 0, "still-down within 30 min → no email");
  assert(ev2.patch.up === undefined || ev2.patch.up === false, "still-down keeps up=false");
}

// ── failed send → retried next check ──────────────────────────────────────────
console.log("failed send retry");
{
  let t = 20 * MIN;
  let s = { ...defaultState(), up: true };
  const ev = evaluate(s, DOWN_SERVER, t);
  s = applyPatch(s, ev.patch); // downAlertPending stays true (send "failed", not cleared)
  const ev2 = evaluate(s, DOWN_SERVER, t + 5 * MIN);
  assert(actionTypes(ev2).includes("alert_down"), "pending alert retried on next check");
}

// ── flap dedup: down→up→down quickly → no second alert ────────────────────────
console.log("flap dedup");
{
  let t = 30 * MIN;
  let s = { ...defaultState(), up: true };
  let ev = evaluate(s, DOWN_SERVER, t);
  s = applyPatch(s, ev.patch);
  s = applyPatch(s, { downAlertPending: false, lastDownAlertAt: t }); // sent
  // recover
  ev = evaluate(s, UP, t + 5 * MIN);
  assert(actionTypes(ev).includes("recover"), "recovers");
  s = applyPatch(s, ev.patch); // lastDownAlertAt KEPT by design
  // down again 5 min later — within 30 min of last alert → suppressed
  ev = evaluate(s, DOWN_SERVER, t + 10 * MIN);
  assert(!actionTypes(ev).includes("alert_down"), "re-down within 30 min → alert suppressed (flap guard)");
  // down again well after the window → alerts
  s = applyPatch(s, ev.patch);
  ev = evaluate(s, DOWN_SERVER, t + 10 * MIN + ALERT_DEDUP_MS + MIN);
  assert(actionTypes(ev).includes("alert_down"), "re-down after 30 min → alert fires");
}

// ── long outage → one reminder per 6 h, no per-check spam ──────────────────────
console.log("long outage reminders");
{
  const start = 100 * MIN;
  let s = { ...defaultState(), up: true };
  let ev = evaluate(s, DOWN_SERVER, start);
  s = applyPatch(s, ev.patch);
  s = applyPatch(s, { downAlertPending: false, lastDownAlertAt: start });

  let reminders = 0;
  let alerts = 0;
  // Simulate 24 h of checks every 5 min.
  for (let t = start + 5 * MIN; t <= start + 24 * 60 * MIN; t += 5 * MIN) {
    ev = evaluate(s, DOWN_SERVER, t);
    for (const a of ev.actions) {
      if (a.type === "reminder") {
        reminders += 1;
        s = applyPatch(s, { lastReminderAt: t });
      }
      if (a.type === "alert_down") alerts += 1;
    }
    s = applyPatch(s, ev.patch);
  }
  assert(alerts === 0, "no extra down alerts during a sustained outage");
  // 24 h / 6 h = 4 reminders.
  assert(reminders === 4, `~one reminder per 6 h over 24 h (got ${reminders})`);
}

// ── recovery resets counters + reports impact ─────────────────────────────────
console.log("recovery");
{
  const start = 0;
  let s = {
    ...defaultState(),
    up: false,
    reason: "server",
    downSince: start,
    lastError: { kind: "server", status: 523 },
    patientsImpacted: 7,
    lastDownAlertAt: start,
    lastReminderAt: start + REMINDER_EVERY_MS,
  };
  const end = 3 * 60 * MIN;
  const ev = evaluate(s, UP, end);
  const rec = ev.actions.find((a) => a.type === "recover");
  assert(!!rec, "emits recover");
  assert(rec.outage.durationMs === end - start, "recover carries outage duration");
  assert(rec.outage.patientsImpacted === 7, "recover reports patientsImpacted");
  assert(ev.patch.up === true, "recovery sets up=true");
  assert(ev.patch.patientsImpacted === 0, "recovery zeroes patientsImpacted");
  assert(ev.patch.downSince === null, "recovery clears downSince");
  assert(ev.patch.downAlertPending === false, "recovery clears downAlertPending");
}

// ── waitlist sweep on steady up ───────────────────────────────────────────────
console.log("waitlist sweep");
{
  let s = { ...defaultState(), up: true, waitlistPending: true };
  const ev = evaluate(s, UP, 5000);
  assert(actionTypes(ev).includes("sweep_waitlist"), "steady-up with pending waitlist → sweep");
  const s2 = { ...defaultState(), up: true, waitlistPending: false };
  const ev2 = evaluate(s2, UP, 5000);
  assert(!actionTypes(ev2).includes("sweep_waitlist"), "no pending → no sweep");
}

// ── config outage classification path ─────────────────────────────────────────
console.log("config outage");
{
  let s = { ...defaultState(), up: true };
  const ev = evaluate(s, DOWN_CONFIG, 1000);
  const a = ev.actions.find((x) => x.type === "alert_down");
  assert(a && a.reason === "config", "401 outage → config-reason alert");
}

console.log("");
if (failures > 0) {
  console.error(`FAILED: ${failures} assertion(s)`);
  process.exit(1);
}
console.log("All health-check state-machine tests passed.");
