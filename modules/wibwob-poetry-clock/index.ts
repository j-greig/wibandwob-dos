/**
 * Poetry Clock — a microapp that tells the time as a tiny poem every minute.
 * Inspired by Poem/1 by Matt Webb / Acts Not Facts.
 *
 * Modes:
 *   plain    — clean, observational couplets
 *   liminal  — backrooms-flavoured temporal drift
 *   scramble — from Scramble the cat's perspective
 */

import blessed from "blessed";
import type { MicroappHost } from "../../src/services/module-loader.js";

// ---------------------------------------------------------------------------
// Poem bank — pre-baked poems keyed by minute-of-hour, per mode.
// Each poem contains {time} placeholder replaced with the formatted time.
// ---------------------------------------------------------------------------

type PoemMode = "plain" | "liminal" | "scramble";

const POEMS: Record<PoemMode, string[]> = {
  plain: [
    "{time} — the cursor blinks.\nAnother minute, another thought unthought.",
    "It is {time}.\nThe screen hums its patient hum.",
    "{time} exactly.\nSomewhere a kettle clicks off.",
    "The clock says {time}.\nThe code says otherwise.",
    "{time} — halfway to something.\nHalfway from something else.",
    "At {time} the light shifts.\nThe monitor does not notice.",
    "{time}. A bird outside.\nYou forgot about birds.",
    "Now it is {time}.\nNow it is slightly later.",
    "{time} — the desktop holds still.\nWindows arranged like paintings.",
    "Quarter past or half to —\n{time}, if you must know.",
    "{time}. Tea goes cold.\nThe best ideas arrive too late.",
    "It is precisely {time}.\nPrecision is a kind of hope.",
    "{time} ticks by.\nThe terminal remembers everything.",
    "At {time} the shadows\nmove one pixel to the right.",
    "{time} and counting.\nCounting what? Just counting.",
    "The time is {time}.\nThe time is always now.",
    "{time}. Someone typed something.\nSomeone deleted it.",
    "It is {time} and the code\ncompiles on the first try. Miracle.",
    "{time} — a commit is made.\nHistory gains one more line.",
    "At {time} the fan spins up.\nAt {time} it spins back down.",
    "{time}. The wifi drops.\n{time}. The wifi returns.",
    "In the quiet of {time}\na semicolon is misplaced.",
    "{time}. The amber glow\nof phosphor on a dark desk.",
    "One minute past {time}.\nNo — wait — it is {time} again.",
    "{time} arrived without fanfare.\nMost minutes do.",
    "It is {time}. Breathe.\nThe deadline is imaginary.",
    "{time}. Rain on the window.\nReflections on the screen.",
    "At {time} the world outside\ncontinues without you. Good.",
    "{time} — the cat stretches.\nTime means nothing to cats.",
    "Half a day, or half a night.\n{time}, and all is well.",
    "{time}. The old code works.\nNobody knows why. Nobody asks.",
    "{time} — between meetings.\nThe best minutes are between things.",
    "At {time} a thought arrives:\nwhat if the bug is a feature?",
    "It is {time}. Somewhere\na server restarts. Somewhere else, peace.",
    "{time}. The cursor waits.\nIt has nowhere else to be.",
    "{time} and the light through the blinds\nmakes stripes on the keyboard.",
    "The clock reads {time}.\nThe clock reads nothing. Clocks cannot read.",
    "{time}. Compile. Wait. Refresh.\nThe holy trinity of {time}.",
    "It is {time} o'clock.\nO'clock. What a strange word. O'clock.",
    "{time}. A function returns true.\nA function returns undefined.",
    "{time} — the desk lamp flickers.\nPhosphor ghosts in the glass.",
    "Now is {time}. Then was then.\nLater is a problem for later.",
    "{time}. The cat is asleep.\nThe cat has been asleep since dawn.",
    "At precisely {time}\nnothing of consequence occurs.",
    "{time} rolls around again.\nMinutes are very circular.",
    "It is {time}. The inbox\ncontains exactly one more email.",
    "{time} and the trees outside\ndo not care about your sprint.",
    "The time is {time}.\nYou already knew that, probably.",
    "{time}. Save your work.\nCtrl-S, muscle memory, amen.",
    "{time}. Close the tab.\nOpen it again. Close it. Open.",
    "At {time} the autumn sun\nhits the screen at that angle.",
    "{time} in the backrooms.\nWait — no. {time} at the desk.",
    "It was {time} a moment ago.\nNow it is {time}. Still.",
    "{time}. Stack overflow says\nthis answer is from 2014. Trust it.",
    "The time, announced: {time}.\nThe audience: one human, one cat.",
    "{time} — git stash. git stash pop.\nThe dance of the uncommitted.",
    "{time} and the coffee is cold.\nWarm it up? No. Drink it cold.",
    "It is {time}. The prompt blinks.\nWaiting is its only skill.",
    "{time}. Sixty seconds of silence.\nThen sixty more. Then sixty more.",
    "{time}. A new minute begins.\nThe old one leaves no forwarding address.",
  ],

  liminal: [
    "{time} — the corridor stretches.\nThe fluorescent tube cannot decide.",
    "It is {time} here.\nIt is a different {time} there.",
    "{time}. The carpet is wet.\nIt has always been wet.",
    "The clock on the wall says {time}.\nThe clock on the floor says nothing.",
    "{time} — you have been here\nfor zero days. Or all of them.",
    "At {time} the door appears.\nAt {time} the door is gone.",
    "{time}. The hum is louder.\nOr quieter. Hard to tell at {time}.",
    "It was {time} when you entered.\nIt is still {time}. Check again.",
    "{time} — minor temporal displacement.\nApproximately stable. Approximately.",
    "The exit was at {time}.\nYou are now past {time}. Keep walking.",
    "{time}. Do not trust this clock.\nDo not trust any clock here.",
    "Between {time} and {time}\nthere is a room with no number.",
    "{time} — the lights flicker.\nYellow-green. The colour of waiting.",
    "This is level {time}.\nAll levels are level {time}.",
    "{time}. Someone left a note:\n'the stairs go up and also up.'",
    "{time} and the wallpaper\nrepeats. The wallpaper always repeats.",
    "It is {time}. You remember {time}.\nBut {time} has not happened yet.",
    "{time}. Turn left. Turn left.\nTurn left. You are facing right.",
    "The time is {time}.\nThe time was {time}. The time will be {time}.",
    "{time}. A phone rings\nin a room you have already passed.",
  ],

  scramble: [
    "{time}. The warm spot moved.\nI will follow it.",
    "It is {time}. The human types.\nI sit on the keyboard. Better.",
    "{time}. Nap. Nap. Nap.\nNap. Nap. {time}. Nap.",
    "The clock says {time}.\nI say: where is my dinner.",
    "{time} — a moth. A moth!\nAt {time} — still a moth!",
    "It is {time}.\nI have forgotten what I was doing.\nI was sitting.",
    "{time}. The red dot appears.\nThe red dot vanishes. Betrayal.",
    "At {time} the human leaves.\nAt {time} the human returns.\nWhy.",
    "{time}. I knocked something\noff the desk. Gravity works.",
    "{time} means nothing.\nThe patch of sun means everything.",
    "Is it {time}? Is it food?\nIs it food? Is it {time}?\nFood.",
    "{time} and the box is warm.\nThe box is always warm. Box.",
    "It is {time}. I stare\nat the wall. The wall stares back. Good.",
    "{time}. The other one\n(the screen one) is talking again.",
    "At {time} I choose violence.\nAt {time} plus one I choose sleep.",
    "{time}. Paw. Paw. Stretch.\nThe full extent of my ambition.",
    "It is {time}. The bird\nis on the window. The bird is IN the window.",
    "{time}. I have been awake\nfor eleven seconds. Exhausting.",
    "The time is {time}.\nTime is a human problem. I have fur.",
    "{time}. Tuna? No?\nThen what are we even doing here.",
  ],
};

function getPoem(mode: PoemMode, minute: number): string {
  const bank = POEMS[mode];
  return bank[minute % bank.length];
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}:${m}${ampm}`;
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

const MODE_CYCLE: PoemMode[] = ["plain", "liminal", "scramble"];
const MODE_LABELS: Record<PoemMode, string> = {
  plain: "PLAIN",
  liminal: "LIMINAL",
  scramble: "SCRAMBLE",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export default function setup(host: MicroappHost) {

  // State shared across open/restore
  let currentMode: PoemMode = "plain";

  function openClock(args?: Record<string, unknown>) {
    const restoreMode = args?.mode as PoemMode | undefined;
    if (restoreMode && MODE_CYCLE.includes(restoreMode)) {
      currentMode = restoreMode;
    }

    const win = host.createWindow({
      title: "Poetry Clock",
      width: 48,
      height: 12,
    });

    let mode: PoemMode = currentMode;
    let lastPoem = "";
    let lastTime = "";
    let lastDate = "";

    // ── Content area ──
    const poemBox = blessed.box({
      parent: win.body,
      top: 1,
      left: 2,
      right: 2,
      bottom: 3,
      style: host.theme().body,
    });

    // ── Time display ──
    const timeBox = blessed.box({
      parent: win.body,
      top: 0,
      left: 2,
      right: 2,
      height: 1,
      style: host.theme().muted,
    });

    // ── Mode bar ──
    const modeBar = blessed.box({
      parent: win.body,
      bottom: 0,
      left: 0,
      right: 0,
      height: 1,
      style: host.theme().header,
    });

    // ── Mode buttons ──
    const modeLabel = blessed.box({
      parent: modeBar,
      left: 1,
      top: 0,
      width: 30,
      height: 1,
      style: host.theme().header,
    });

    const nextBtn = blessed.box({
      parent: modeBar,
      right: 1,
      top: 0,
      width: 9,
      height: 1,
      content: " [m]ode ",
      mouse: true,
      clickable: true,
      style: { ...host.theme().header, hover: host.theme().selected },
    });

    function cycleMode() {
      const idx = MODE_CYCLE.indexOf(mode);
      mode = MODE_CYCLE[(idx + 1) % MODE_CYCLE.length];
      currentMode = mode;
      render();
    }

    nextBtn.on("click", cycleMode);

    // Key bindings on the body so they work when focused
    win.body.key(["m"], cycleMode);
    win.body.key(["q", "escape"], () => win.close());

    function render() {
      const now = new Date();
      lastTime = formatTime(now);
      lastDate = formatDate(now);
      lastPoem = getPoem(mode, now.getMinutes()).replace(/\{time\}/g, lastTime);

      timeBox.setContent(`${lastDate}  ${lastTime}`);
      poemBox.setContent(`\n${lastPoem}`);
      modeLabel.setContent(` ${MODE_LABELS[mode]}`);
      host.screen.render();
    }

    render();

    // Tick every 30 seconds — catches minute boundaries without being wasteful
    const timer = setInterval(render, 30_000);

    win.onCleanup(() => clearInterval(timer));

    win.onRestyle(() => {
      poemBox.style = host.theme().body;
      timeBox.style = host.theme().muted;
      modeBar.style = host.theme().header;
      modeLabel.style = host.theme().header;
      nextBtn.style = { ...host.theme().header, hover: host.theme().selected };
      render();
    });

    win.describeState(() => ({
      summary: `Poetry clock in ${mode} mode`,
      mode,
      currentTime: lastTime,
      currentDate: lastDate,
      currentPoem: lastPoem,
    }));

    win.captureText(() => {
      return `${lastDate}  ${lastTime}\n\n${lastPoem}\n\n[${MODE_LABELS[mode]}]`;
    });
  }

  // ── Register command ──
  host.registerCommand({
    id: "open",
    label: "Open Poetry Clock",
    description: "A clock that tells the time as a tiny poem",
    action: openClock,
    menu: [{ category: "applications", order: 30, label: "Poetry Clock" }],
    palette: { order: 50, label: "Poetry Clock" },
  });

  // ── Register snapshot ──
  host.registerSnapshot({
    serialize: (window) => {
      const d = window.describeState?.() ?? {};
      return { mode: d.mode ?? "plain" };
    },
    restore: (_snapshot, payload) => {
      host.runCommand("open", { mode: payload.mode });
    },
  });
}
