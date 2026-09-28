import { i as __toESM } from "../_runtime.mjs";
import { R as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { r as uid, t as cn } from "./utils-DaIbQSVg.mjs";
import { a as Scissors, c as Mountain, d as ArrowRight, i as ScrollText, l as Flower2, o as Recycle, r as Sprout, s as Plus, t as X, u as Eye } from "../_libs/lucide-react.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-C6tNf5JA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CardHover({ card, swap, x, y }) {
	const pair = Boolean(swap?.image || swap);
	const width = pair ? 520 : 240;
	const left = Math.min(x + 18, typeof window !== "undefined" ? window.innerWidth - width - 16 : x);
	const top = Math.min(Math.max(12, y - 40), typeof window !== "undefined" ? window.innerHeight - (pair ? 380 : 420) : y);
	if (pair && swap) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "card-preview",
		style: {
			left,
			top
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Face, { card }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "swap-arrow" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Face, { card: swap })
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "card-preview card-preview-single",
		style: {
			left,
			top
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Face, { card }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "space-y-1 p-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm text-parchment",
					children: card.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-mute",
					children: [
						card.manaCost,
						" · ",
						card.typeLine
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-h-28 overflow-hidden text-xs leading-snug text-cream/85",
					children: card.oracleText || "No Oracle text."
				})
			]
		})]
	});
}
function Face({ card }) {
	const src = card.image || card.imageSmall;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "card-preview-face",
		children: src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: card.name
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: card.name })
	});
}
var CATEGORY_ORDER = [
	"Commander",
	"Planeswalkers",
	"Creatures",
	"Instants",
	"Sorceries",
	"Enchantments",
	"Artifacts",
	"Battles",
	"Lands",
	"Other",
	"Nursery"
];
function categoryFor(entry, card) {
	if (entry.zone === "nursery") return "Nursery";
	if (entry.zone === "commander") return "Commander";
	const t = (card?.typeLine ?? "").toLowerCase();
	if (t.includes("land")) return "Lands";
	if (t.includes("planeswalker")) return "Planeswalkers";
	if (t.includes("creature")) return "Creatures";
	if (t.includes("instant")) return "Instants";
	if (t.includes("sorcery")) return "Sorceries";
	if (t.includes("enchantment")) return "Enchantments";
	if (t.includes("artifact")) return "Artifacts";
	if (t.includes("battle")) return "Battles";
	return "Other";
}
function groupedEntries(entries, cards) {
	const buckets = /* @__PURE__ */ new Map();
	for (const cat of CATEGORY_ORDER) buckets.set(cat, []);
	for (const e of entries) {
		const card = cards[e.name.toLowerCase()];
		const cat = categoryFor(e, card);
		buckets.get(cat).push(e);
	}
	for (const rows of buckets.values()) rows.sort((a, b) => {
		const ca = cards[a.name.toLowerCase()];
		const cb = cards[b.name.toLowerCase()];
		const cmc = (ca?.cmc ?? 99) - (cb?.cmc ?? 99);
		if (cmc !== 0) return cmc;
		return a.name.localeCompare(b.name);
	});
	return CATEGORY_ORDER.map((category) => {
		const rows = buckets.get(category) ?? [];
		return {
			category,
			rows,
			count: rows.reduce((n, r) => n + r.count, 0)
		};
	}).filter((g) => g.rows.length > 0);
}
function lookup(cards, name) {
	return cards[name.toLowerCase()];
}
function colorIdentityOf(commanderName, cards, entries) {
	if (commanderName) {
		const c = lookup(cards, commanderName);
		if (c) return c.colorIdentity;
	}
	const set = /* @__PURE__ */ new Set();
	for (const e of entries) {
		if (e.zone === "nursery") continue;
		const card = lookup(cards, e.name);
		for (const col of card?.colorIdentity ?? []) set.add(col);
	}
	return [
		"W",
		"U",
		"B",
		"R",
		"G"
	].filter((c) => set.has(c));
}
function detectCommander(entries, cards) {
	const tagged = entries.find((e) => e.zone === "commander");
	if (tagged) return tagged.name;
	const legends = [];
	for (const e of entries) {
		const c = lookup(cards, e.name);
		if (!c) continue;
		const t = c.typeLine.toLowerCase();
		if (t.includes("legendary") && t.includes("creature")) legends.push(e);
	}
	if (legends.length === 1) return legends[0].name;
	return null;
}
function blob(entries, cards) {
	return entries.map((e) => lookup(cards, e.name)).filter(Boolean).map((c) => `${c.name} ${c.typeLine} ${c.oracleText} ${(c.keywords ?? []).join(" ")}`).join(" \n ").toLowerCase();
}
function guessLanes(commanderName, entries, cards) {
	const text = blob(entries, cards);
	const commander = commanderName?.toLowerCase() ?? "";
	const scores = [];
	const wheels = (text.match(/each player discards|discard your hand|draw (seven|cards equal)|wheel/g) ?? []).length;
	const mill = (text.match(/mill \d+|put the top/g) ?? []).length;
	const voltronish = (text.match(/equip|aura|commander creatures you control|hexproof|unblocked/g) ?? []).length + (commander.includes("mimeoplasm") ? 4 : 0);
	const tokens = (text.match(/create .* token/g) ?? []).length;
	const combo = (text.match(/infinite|win the game|thassa's oracle|laboratory maniac/g) ?? []).length;
	const infect = (text.match(/infect|poison|toxic|proliferate/g) ?? []).length;
	const counters = (text.match(/counter target (spell|ability)/g) ?? []).length;
	const grind = (text.match(/draw a card|whenever .* dies|exploit|forage/g) ?? []).length;
	if (voltronish >= 3) scores.push({
		lane: "voltron",
		n: voltronish
	});
	if (wheels >= 4) scores.push({
		lane: "control",
		n: wheels
	});
	if (tokens >= 6) scores.push({
		lane: "wide",
		n: tokens
	});
	if (combo >= 2) scores.push({
		lane: "combo",
		n: combo
	});
	if (infect >= 4) scores.push({
		lane: "alt",
		n: infect
	});
	if (mill >= 6 && voltronish < 3) scores.push({
		lane: "value",
		n: mill
	});
	if (counters >= 4 && grind >= 8) scores.push({
		lane: "control",
		n: counters
	});
	if (grind >= 10) scores.push({
		lane: "value",
		n: grind
	});
	if (commander.includes("mimeoplasm")) scores.push({
		lane: "toolbox",
		n: 5
	});
	scores.sort((a, b) => b.n - a.n);
	const unique = [];
	for (const s of scores) if (!unique.includes(s.lane)) unique.push(s.lane);
	if (unique.length === 0) unique.push("unknown");
	return unique.slice(0, 3);
}
function countRole(entries, cards, test) {
	let n = 0;
	for (const e of entries) {
		if (e.zone === "nursery") continue;
		const c = lookup(cards, e.name);
		if (c && test(c)) n += e.count;
	}
	return n;
}
var roleTests = {
	draw: (c) => /draw (a card|two|three|seven|x cards)/i.test(c.oracleText) && !c.typeLine.toLowerCase().includes("land"),
	ramp: (c) => (c.producedMana?.length ?? 0) > 0 && !c.typeLine.toLowerCase().includes("land") || /search your library for.*land/i.test(c.oracleText),
	interaction: (c) => /destroy target|exile target|counter target|fight|deal .* damage to any target/i.test(c.oracleText),
	wincon: (c) => /win the game|you win|infect|commander damage|trample/i.test(c.oracleText) || Number(c.power) >= 7 && c.keywords.some((k) => /trample|haste/i.test(k))
};
function slotOf(c) {
	const type = c.typeLine.toLowerCase();
	const text = c.oracleText;
	const creature = type.includes("creature");
	const land = type.includes("land") && !creature;
	if (/(destroy|exile|return) all (creatures|permanents|nonland)/i.test(text) || /each creature/i.test(text) && /(destroy|exile|gets\s*-)/i.test(text) || /overload/i.test(text)) return "wipe";
	if (/counter target/i.test(text)) return "counter";
	if (!creature && /destroy target|exile target (creature|permanent|artifact|enchantment)|fight /i.test(text)) return "spot";
	if (roleTests.draw(c)) return "draw";
	if (/search your library for/i.test(text) && !/land/i.test(text)) return "tutor";
	if (creature && (roleTests.ramp(c) || /add \{/.test(text))) return "dork";
	if (!creature && !land && (roleTests.ramp(c) || /add \{/.test(text))) return "rock";
	if (!creature && /search your library for.*land/i.test(text)) return "ramp";
	if (land) return "land";
	if (creature) return "creature";
	return "synergy";
}
function kindOf(c) {
	const t = c.typeLine.toLowerCase();
	if (t.includes("land") && !t.includes("creature")) return "land";
	if (t.includes("creature")) return "creature";
	if (t.includes("instant") || t.includes("sorcery")) return "spell";
	if (t.includes("artifact")) return "artifact";
	if (t.includes("enchantment")) return "enchantment";
	if (t.includes("planeswalker")) return "planeswalker";
	return "other";
}
var RAMP_SLOTS = /* @__PURE__ */ new Set([
	"ramp",
	"dork",
	"rock"
]);
function canSwap(cut, add) {
	const from = slotOf(cut);
	const to = slotOf(add);
	if (from === "wipe" && to !== "wipe") return false;
	if (from === "counter" && to !== "counter") return false;
	if (from === "spot" && to !== "spot") return false;
	if (from === "land" && to !== "land") return false;
	if (from === "creature" && to !== "creature") return false;
	if (kindOf(cut) !== kindOf(add)) {
		if (!(RAMP_SLOTS.has(from) && RAMP_SLOTS.has(to))) return false;
	}
	if (from === to) return true;
	if (RAMP_SLOTS.has(from) && RAMP_SLOTS.has(to)) return true;
	return false;
}
var TAX_CLAIMS = [
	{
		id: "discard-cost",
		reason: /discard/i,
		oracle: /discard a card\s*:|cumulative upkeep[^\n.]{0,80}discard|pay[^\n.]{0,40}discard a card/i
	},
	{
		id: "self-mill",
		reason: /\bmill(s|ing)?\b/i,
		oracle: /\bmill\b|put the top .{0,30} of your library into/i
	},
	{
		id: "extra-turn",
		reason: /extra turn/i,
		oracle: /take an extra turn/i
	},
	{
		id: "skip-untap",
		reason: /doesn't untap|skip(?:s|ping)? (?:your |the )?untap/i,
		oracle: /doesn't untap during|skip your (?:next )?untap/i
	}
];
function taxesClaimedByTrim(trim) {
	return TAX_CLAIMS.filter((c) => trim.some((t) => c.reason.test(t.reason))).map((c) => c.id);
}
function contradictsCuts(card, trim) {
	const claimed = taxesClaimedByTrim(trim);
	if (!claimed.length) return false;
	return TAX_CLAIMS.some((c) => claimed.includes(c.id) && c.oracle.test(card.oracleText));
}
function pairReplacements(deck, items) {
	const grow = deck.analysis?.grow ?? [];
	const used = /* @__PURE__ */ new Set();
	const map = /* @__PURE__ */ new Map();
	const fits = (cutName, g) => {
		const cut = lookup(deck.cards, cutName);
		const add = lookup(deck.cards, g.name);
		if (!cut?.oracleText || !add?.oracleText) return false;
		if (contradictsCuts(add, items)) return false;
		return canSwap(cut, add);
	};
	for (const t of items) {
		if (!t.replaceWith) continue;
		const g = grow.find((x) => x.name.toLowerCase() === t.replaceWith.toLowerCase());
		if (g && fits(t.name, g)) {
			map.set(t.name, g);
			used.add(g.name.toLowerCase());
		}
	}
	for (const t of items) {
		if (map.has(t.name)) continue;
		const g = grow.find((x) => !used.has(x.name.toLowerCase()) && fits(t.name, x));
		if (g) {
			map.set(t.name, g);
			used.add(g.name.toLowerCase());
		}
	}
	return map;
}
function trimSwaps(deck) {
	const main = new Set(deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name.toLowerCase()));
	return pairReplacements(deck, (deck.analysis?.trim ?? []).filter((v) => main.has(v.name.toLowerCase())));
}
var GAME_CHANGERS = new Set([
	"Rhystic Study",
	"Smothering Tithe",
	"Fierce Guardianship",
	"Deadly Rollick",
	"Cyclonic Rift",
	"Demonic Tutor",
	"Vampiric Tutor",
	"Mystical Tutor",
	"Imperial Seal",
	"Mana Drain",
	"Force of Will",
	"Force of Negation",
	"The One Ring",
	"Gaea's Cradle",
	"Ancient Tomb",
	"Lion's Eye Diamond",
	"Mana Crypt",
	"Chrome Mox",
	"Mox Diamond",
	"Survival of the Fittest",
	"Natural Order",
	"Underworld Breach",
	"Thassa's Oracle",
	"Ad Nauseam",
	"Jeska's Will",
	"Bolas's Citadel",
	"Consecrated Sphinx",
	"Drannith Magistrate",
	"Opposition Agent",
	"Seedborn Muse"
].map((n) => n.toLowerCase()));
var COL_GAP = 24;
function packColumns(items, colCount) {
	const n = items.length;
	if (!n) return [];
	const cols = Math.max(1, Math.min(colCount, n));
	const base = Math.floor(n / cols);
	const extra = n % cols;
	const out = [];
	let i = 0;
	for (let c = 0; c < cols; c++) {
		const size = base + (c < extra ? 1 : 0);
		out.push(items.slice(i, i + size));
		i += size;
	}
	return out;
}
function DeckList({ deck }) {
	const [hover, setHover] = (0, import_react.useState)(null);
	const groups = (0, import_react.useMemo)(() => groupedEntries(deck.entries, deck.cards), [deck.entries, deck.cards]);
	const weeds = new Set((deck.analysis?.trim ?? []).map((t) => t.name.toLowerCase()));
	const locked = new Set(deck.packet.lockedNames.map((n) => n.toLowerCase()));
	const swaps = (0, import_react.useMemo)(() => trimSwaps(deck), [deck]);
	const longest = (0, import_react.useMemo)(() => {
		let name = "";
		let count = 1;
		for (const e of deck.entries) if (e.name.length > name.length) {
			name = e.name;
			count = e.count;
		}
		return {
			name,
			count
		};
	}, [deck.entries]);
	const probeRef = (0, import_react.useRef)(null);
	const areaRef = (0, import_react.useRef)(null);
	const [colPx, setColPx] = (0, import_react.useState)(220);
	const [colCount, setColCount] = (0, import_react.useState)(1);
	(0, import_react.useLayoutEffect)(() => {
		const probe = probeRef.current;
		if (!probe) return;
		const measure = () => {
			const w = probe.getBoundingClientRect().width;
			if (w > 0) setColPx(Math.ceil(w) + 8);
		};
		measure();
		document.fonts.ready.then(measure);
	}, [longest.name, longest.count]);
	(0, import_react.useLayoutEffect)(() => {
		const el = areaRef.current;
		if (!el) return;
		const measure = () => {
			const cs = getComputedStyle(el);
			const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 22;
			const next = Math.max(1, Math.floor((inner + COL_GAP) / (colPx + COL_GAP)));
			setColCount(next);
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, [colPx]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				ref: probeRef,
				"aria-hidden": true,
				className: "pointer-events-none invisible absolute left-0 top-0 flex items-baseline gap-2 whitespace-nowrap px-1 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "w-6 tabular-nums",
					children: [longest.count, "x"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: longest.name || "Card Name" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: areaRef,
				className: "min-h-0 flex-1 overflow-y-auto px-6 py-4",
				style: { ["--name-col"]: `${colPx}px` },
				children: [deck.unresolved.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mb-4 text-xs text-nightshade",
					children: ["Unresolved (not a real card name): ", deck.unresolved.join(", ")]
				}) : null, groups.map((g) => {
					const rows = g.rows;
					if (!rows.length) return null;
					const columns = packColumns(rows, colCount);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "deck-bed",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
							className: "deck-bed-title",
							children: [
								g.category.toUpperCase(),
								" (",
								g.count,
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "deck-cols",
							children: columns.map((col, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: col.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardLine, {
								row,
								card: lookup(deck.cards, row.name),
								weed: weeds.has(row.name.toLowerCase()),
								swap: swaps.has(row.name),
								locked: locked.has(row.name.toLowerCase()),
								role: deck.packet.customRoles[row.name],
								onHover: (card, x, y) => {
									const rec = swaps.get(row.name);
									const swap = rec ? lookup(deck.cards, rec.name) : void 0;
									setHover({
										card,
										swap,
										x,
										y
									});
								},
								onLeave: () => setHover(null)
							}, `${row.zone}-${row.name}`)) }, i))
						})]
					}, g.category);
				})]
			}),
			hover ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHover, {
				card: hover.card,
				swap: hover.swap,
				x: hover.x,
				y: hover.y
			}) : null
		]
	});
}
function CardLine({ row, card, weed, swap, locked, role, onHover, onLeave }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		onMouseEnter: (e) => {
			if (card) onHover(card, e.clientX, e.clientY);
		},
		onMouseMove: (e) => {
			if (card) onHover(card, e.clientX, e.clientY);
		},
		onMouseLeave: onLeave,
		className: cn("flex w-full items-baseline gap-2 rounded-sm px-1 py-0.5 text-left text-sm", swap && "deck-swap", weed && !swap && "deck-weed", locked && !weed && !swap && "text-filigree", !weed && !swap && !locked && "text-cream"),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "w-6 shrink-0 tabular-nums text-mute",
			children: [row.count, "x"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "min-w-0",
			children: [row.name, role ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-1.5 text-xs tracking-wide text-sap",
				children: role
			}) : null]
		})]
	}) });
}
function Hint({ text, side = "right", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "hint",
		"data-side": side,
		children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			role: "tooltip",
			children: text
		})]
	});
}
var COLOR = {
	W: "bg-mana-w",
	U: "bg-mana-u",
	B: "bg-mana-b ring-1 ring-filigree/30",
	R: "bg-mana-r",
	G: "bg-mana-g"
};
function ManaDots({ colors, size = "sm" }) {
	if (!colors.length) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("inline-block rounded-full bg-mute/50", size === "sm" ? "size-1.5" : "size-2") });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "flex items-center justify-center gap-0.5",
		children: colors.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			title: c,
			className: cn("rounded-full", COLOR[c] ?? "bg-mute", size === "sm" ? "size-1.5" : "size-2")
		}, c))
	});
}
var STOP$1 = /* @__PURE__ */ new Set([
	"the",
	"of",
	"a",
	"and",
	"to",
	"in",
	"for"
]);
function abbreviate(name, taken) {
	const seed = (name.replace(/[^A-Za-z0-9\s,']/g, " ").trim().split(/[\s,]+/).map((p) => p.replace(/'/g, "")).filter((p) => p && !STOP$1.has(p.toLowerCase()))[0] ?? name).replace(/[^A-Za-z0-9]/g, "");
	let base = seed.slice(0, 5).toUpperCase().padEnd(Math.min(5, seed.length), "");
	if (base.length < 2) base = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
	if (!base) base = "DECK";
	let short = base.slice(0, 5);
	if (!taken.has(short)) return short;
	for (let i = 2; i < 100; i++) {
		const suffix = String(i);
		const next = (base.slice(0, 5 - suffix.length) + suffix).slice(0, 5);
		if (!taken.has(next)) return next;
	}
	return short;
}
var BASIC_COLOR = {
	plains: "W",
	island: "U",
	swamp: "B",
	mountain: "R",
	forest: "G",
	"snow-covered plains": "W",
	"snow-covered island": "U",
	"snow-covered swamp": "B",
	"snow-covered mountain": "R",
	"snow-covered forest": "G",
	"wastes": "W"
};
function isLand(card) {
	return card.typeLine.toLowerCase().includes("land");
}
function entersTapped(card) {
	const t = card.oracleText.toLowerCase();
	if (!t.includes("enters tapped")) return false;
	if (t.includes("enters tapped unless")) return false;
	return true;
}
function produces(card) {
	return (card.producedMana?.length ?? 0) > 0 || /add \{/.test(card.oracleText) || /add one mana/i.test(card.oracleText);
}
function isRock(card) {
	return card.typeLine.toLowerCase().includes("artifact") && !card.typeLine.toLowerCase().includes("creature") && produces(card) && card.cmc <= 3;
}
function isDork(card) {
	return card.typeLine.toLowerCase().includes("creature") && produces(card) && card.cmc <= 2;
}
var SEARCHERS = [
	{
		test: (c) => /search your library for (a|up to two|up to three)? ?basic land/i.test(c.oracleText),
		needs: "Basics"
	},
	{
		test: (c) => /search your library for a forest/i.test(c.oracleText) || c.name === "Nature's Lore" || c.name === "Three Visits",
		needs: "Forest cards (duals with types count)"
	},
	{
		test: (c) => c.name === "Farseek",
		needs: "A Plains, Island, Swamp, or Mountain — usually a nonbasic with a type"
	},
	{
		test: (c) => /sacrifice (this|a) land/i.test(c.oracleText) && /search your library for (a|two)? ?(basic )?(land|plains|island|swamp|mountain|forest)/i.test(c.oracleText) && isLand(c),
		needs: "Basics or typed duals for fetches"
	}
];
function analyzeSoil(entries, cards, format) {
	const main = entries.filter((e) => e.zone !== "nursery");
	const of = (name) => lookup(cards, name);
	const lands = main.filter((e) => {
		const c = of(e.name);
		return c && isLand(c);
	});
	const landCount = lands.reduce((n, e) => n + e.count, 0);
	let rocks = 0;
	let dorks = 0;
	let landRamp = 0;
	let highCmc = 0;
	for (const e of main) {
		const c = of(e.name);
		if (!c) continue;
		if (isRock(c)) rocks += e.count;
		if (isDork(c)) dorks += e.count;
		if (!isLand(c) && /search your library for.*land/i.test(c.oracleText)) landRamp += e.count;
		if (c.cmc >= 5 && !isLand(c)) highCmc += e.count;
	}
	const base = format === "commander" ? 37 : 24;
	const adj = Math.round(base - .4 * rocks - .35 * dorks + (highCmc > 8 ? 1 : 0) - (landRamp >= 4 ? 0 : 0));
	const targetMin = Math.max(format === "commander" ? 32 : 20, adj - 1);
	const targetMax = Math.min(format === "commander" ? 40 : 27, adj + 1);
	const taplands = lands.map((e) => of(e.name)).filter((c) => !!c && entersTapped(c)).map((c) => c.name);
	const tapBudget = format === "commander" ? Math.max(3, Math.round(landCount / 4)) : 2;
	const basics = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0
	};
	for (const e of lands) {
		const key = BASIC_COLOR[e.name.toLowerCase()];
		if (key) basics[key] += e.count;
	}
	const searchers = [];
	for (const e of main) {
		const c = of(e.name);
		if (!c) continue;
		for (const s of SEARCHERS) if (s.test(c)) {
			searchers.push({
				name: c.name,
				needs: s.needs
			});
			break;
		}
	}
	const fetchish = searchers.some((s) => /fetch|basic/i.test(s.needs));
	const basicTotal = basics.W + basics.U + basics.B + basics.R + basics.G;
	let basicNeed = "Basics look incidental.";
	if (searchers.length && basicTotal < 4) basicNeed = "Searchers want more basics than you currently run.";
	else if (fetchish && basicTotal >= 6) basicNeed = "Basic count matches the searchers in the list.";
	else if (basicTotal >= 8) basicNeed = "Heavy basics — fine if Harrow / Cultivate / Vista are in here; not a fetch-dual pile.";
	const colorHoles = [];
	const sources = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0
	};
	for (const e of lands) {
		const c = of(e.name);
		if (!c) continue;
		const prod = c.producedMana.length ? c.producedMana : c.colorIdentity;
		for (const col of prod) if (sources[col] != null) sources[col] += e.count;
	}
	const pips = {
		W: 0,
		U: 0,
		B: 0,
		R: 0,
		G: 0
	};
	for (const e of main) {
		const c = of(e.name);
		if (!c || isLand(c)) continue;
		const cost = c.manaCost ?? "";
		for (const col of [
			"W",
			"U",
			"B",
			"R",
			"G"
		]) {
			const n = (cost.match(new RegExp(col, "g")) ?? []).length;
			pips[col] += n * e.count;
		}
	}
	for (const col of [
		"W",
		"U",
		"B",
		"R",
		"G"
	]) if (pips[col] >= 6 && sources[col] < 6) colorHoles.push(`${col}: ${pips[col]} pips vs ${sources[col]} sources`);
	const rationale = [
		`${format === "commander" ? "Commander" : "60-card"} default ${base}.`,
		rocks ? `${rocks} cheap rocks pull the count down.` : null,
		dorks ? `${dorks} dorks pull a little down (they die).` : null,
		landRamp ? `${landRamp} land-searchers still want land drops — don't starve them.` : null,
		highCmc > 8 ? `Lots of 5+ drops; keep the top of the range.` : null
	].filter(Boolean).join(" ");
	const cut = [];
	if (taplands.length > tapBudget + 2) cut.push(...taplands.slice(tapBudget));
	const keep = lands.map((e) => e.name).filter((n) => !cut.includes(n));
	const add = [];
	if (landCount < targetMin) add.push(`Need ~${targetMin - landCount} more lands`);
	if (landCount > targetMax) add.push(`You can cut ~${landCount - targetMax} lands if the rocks come online`);
	return {
		landCount,
		targetMin,
		targetMax,
		rationale,
		taplands,
		tapBudget,
		basics,
		basicNeed,
		searchers,
		colorHoles,
		keep,
		cut,
		add
	};
}
var SECTION = /^(land|lands|creature|creatures|instant|instants|sorcery|sorceries|artifact|artifacts|enchantment|enchantments|planeswalker|planeswalkers|battle|battles|commander|commanders|sideboard|maybeboard|considering|nursery|deck|other)\s*(?:\(?\d+\)?)?\s*$/i;
var CARD_LINE = /^(?:[*•\-]\s*)?(\d+)\s*x?\s+(.+?)\s*$/i;
var SET_SUFFIX = /\s+\([A-Za-z0-9]{2,5}\)(?:\s+\S+)?\s*$/;
function zoneForSection(section) {
	const s = section.toLowerCase();
	if (s.startsWith("commander")) return "commander";
	if (s.startsWith("side") || s.startsWith("maybe") || s.startsWith("consider") || s.startsWith("nursery")) return "nursery";
	return "main";
}
function cleanName(raw) {
	return raw.replace(SET_SUFFIX, "").replace(/\s+/g, " ").trim();
}
function parseDeckList(raw) {
	const merged = /* @__PURE__ */ new Map();
	let section = "deck";
	for (const line0 of raw.split(/\r?\n/)) {
		const line = line0.trim();
		if (!line || line.startsWith("#") || line.startsWith("//")) continue;
		if (SECTION.test(line)) {
			section = line.replace(/\(.*\)/, "").trim();
			continue;
		}
		const m = line.match(CARD_LINE);
		if (!m) continue;
		const count = Number(m[1]);
		const name = cleanName(m[2] ?? "");
		if (!name || !count) continue;
		const zone = zoneForSection(section);
		const key = `${zone}::${name.toLowerCase()}`;
		const prev = merged.get(key);
		if (prev) prev.count += count;
		else merged.set(key, {
			count,
			name,
			zone
		});
	}
	return [...merged.values()];
}
function uniqueNames(entries) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const e of entries) {
		const k = e.name.toLowerCase();
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(e.name);
	}
	return out;
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var resolveCardNames = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("0616887fd5a1dc88df87409997de362ed30e6b3b75cb4c553ba05ee7c28f129d"));
var fetchCommanderMeta = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("b1642393a748faffb667e3b326bc29e5b67d56173134c94e37d0b011842f8264"));
var tendDeck = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("94c3b0a223a4674084035a9092bdca7cbb83abd9474e3440670929c26bfda5d6"));
var EMPTY_PACKET = {
	job: null,
	lane: null,
	table: "hold",
	fences: [],
	budget: null,
	driveNotes: "",
	lockedNames: [],
	neverNames: [],
	customRoles: {},
	defenses: {},
	feedback: "",
	answers: {}
};
var JOBS = [
	{
		id: "diagnose",
		label: "What's this doing?",
		hint: "Explain the plan first. Don't change the list yet."
	},
	{
		id: "patch",
		label: "Keep the plan",
		hint: "Fill holes — draw, interaction, a real win. Don't rebuild."
	},
	{
		id: "theme",
		label: "More itself",
		hint: "Cut generic staples that don't say this commander's name."
	},
	{
		id: "push",
		label: "Stronger",
		hint: "Higher floor, faster close, same game plan."
	},
	{
		id: "restrain",
		label: "Tamer",
		hint: "Bring power and salt down to the table you named."
	},
	{
		id: "budget",
		label: "Cheaper",
		hint: "Same roles, lower price. Keep the plan."
	},
	{
		id: "soil",
		label: "Just the manabase",
		hint: "Lands only — count, taplands, basics your searchers can hit."
	}
];
var LANES = [
	{
		id: "voltron",
		label: "Voltron / one attacker",
		hint: "Win by attacking with one stacked creature, often the commander."
	},
	{
		id: "wide",
		label: "Go wide",
		hint: "Win with a board of creatures, not one big threat."
	},
	{
		id: "combo",
		label: "Combo",
		hint: "A finite or infinite combo is the intended close."
	},
	{
		id: "control",
		label: "Control / lock",
		hint: "Answer everything until they fold — counters, wheels, stax."
	},
	{
		id: "value",
		label: "Value grind",
		hint: "Out-resource the table; the win is whatever's left standing."
	},
	{
		id: "alt",
		label: "Alt win (poison, mill)",
		hint: "Poison, mill, or another non-combat win is the point."
	},
	{
		id: "toolbox",
		label: "Toolbox",
		hint: "Several of the above on purpose — pick the right close per game."
	},
	{
		id: "unknown",
		label: "You tell me",
		hint: "No lane yet. We'll guess from the list, then you correct it."
	}
];
var TABLES = [
	{
		id: "precon",
		label: "Precon night",
		hint: "Keep it friendly. No Game Changer hunt."
	},
	{
		id: "focused",
		label: "Focused casual",
		hint: "A real plan, not a tuned cEDH list."
	},
	{
		id: "high",
		label: "High power",
		hint: "Fast, mean, still not a tournament table."
	},
	{
		id: "cedh",
		label: "cEDH",
		hint: "Optimized. Expect tutors, fast mana, and interaction."
	},
	{
		id: "hold",
		label: "Don't move the power",
		hint: "Match what's already in the list. Don't upgrade or nerf."
	}
];
var FENCES = [
	{
		id: "no-extra-turns",
		label: "No extra turns",
		hint: "Don't add Time Warp, extra combat, or take-another-turn effects."
	},
	{
		id: "no-stax",
		label: "No stax",
		hint: "Don't add prison pieces that freeze other people's decks."
	},
	{
		id: "no-infect",
		label: "Infect is not the plan",
		hint: "Infect can stay as a hat. Don't make poison the win."
	},
	{
		id: "no-infinites",
		label: "No infinites",
		hint: "Finite combos are fine. Don't add loops that go infinite."
	},
	{
		id: "no-game-changers",
		label: "No more Game Changers",
		hint: "Don't add cards from the Commander Game Changer list."
	},
	{
		id: "no-steal",
		label: "Don't steal opponents' cards",
		hint: "Leave their graveyards and boards alone."
	}
];
var STARTER_ID = "plot-1";
function starterDeck() {
	return {
		id: STARTER_ID,
		name: "New deck",
		short: "NEW",
		createdAt: 0,
		rawList: "",
		entries: [],
		cards: {},
		unresolved: [],
		packet: { ...EMPTY_PACKET },
		analysis: null,
		soil: null,
		commanderName: null,
		format: "commander"
	};
}
function takenShorts(decks, except) {
	return new Set(decks.filter((d) => d.id !== except).map((d) => d.short));
}
var useGarden = create()(persist((set, get) => ({
	decks: [starterDeck()],
	activeId: STARTER_ID,
	spine: null,
	busy: null,
	error: null,
	setSpine: (spine) => set({ spine }),
	setActive: (id) => set({
		activeId: id,
		error: null
	}),
	addEmptyDeck: () => {
		const id = uid();
		const deck = {
			id,
			name: "New deck",
			short: abbreviate("NEW", takenShorts(get().decks)),
			createdAt: Date.now(),
			rawList: "",
			entries: [],
			cards: {},
			unresolved: [],
			packet: { ...EMPTY_PACKET },
			analysis: null,
			soil: null,
			commanderName: null,
			format: "commander"
		};
		set((s) => ({
			decks: [...s.decks, deck],
			activeId: id,
			spine: null
		}));
		return id;
	},
	removeDeck: (id) => set((s) => {
		const decks = s.decks.filter((d) => d.id !== id);
		return {
			decks,
			activeId: s.activeId === id ? decks[0]?.id ?? null : s.activeId
		};
	}),
	renameShort: (id, short) => set((s) => ({ decks: s.decks.map((d) => d.id === id ? {
		...d,
		short: short.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() || d.short
	} : d) })),
	renameDeck: (id, name) => set((s) => ({ decks: s.decks.map((d) => d.id === id ? {
		...d,
		name
	} : d) })),
	patchPacket: (id, patch) => set((s) => ({ decks: s.decks.map((d) => d.id === id ? {
		...d,
		packet: {
			...d.packet,
			...patch
		}
	} : d) })),
	toggleLock: (id, name) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		const has = d.packet.lockedNames.some((n) => n.toLowerCase() === name.toLowerCase());
		return {
			...d,
			packet: {
				...d.packet,
				lockedNames: has ? d.packet.lockedNames.filter((n) => n.toLowerCase() !== name.toLowerCase()) : [...d.packet.lockedNames, name]
			}
		};
	}) })),
	argueKeep: (id, name, reason) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		const locked = d.packet.lockedNames.some((n) => n.toLowerCase() === name.toLowerCase()) ? d.packet.lockedNames : [...d.packet.lockedNames, name];
		return {
			...d,
			packet: {
				...d.packet,
				lockedNames: locked,
				defenses: {
					...d.packet.defenses ?? {},
					[name]: reason.trim()
				}
			}
		};
	}) })),
	toggleNever: (id, name) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		const has = d.packet.neverNames.some((n) => n.toLowerCase() === name.toLowerCase());
		return {
			...d,
			packet: {
				...d.packet,
				neverNames: has ? d.packet.neverNames.filter((n) => n.toLowerCase() !== name.toLowerCase()) : [...d.packet.neverNames, name]
			}
		};
	}) })),
	setRole: (id, name, role) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		const customRoles = { ...d.packet.customRoles };
		if (!role) delete customRoles[name];
		else customRoles[name] = role;
		return {
			...d,
			packet: {
				...d.packet,
				customRoles
			}
		};
	}) })),
	moveToNursery: (id, name) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		return {
			...d,
			entries: d.entries.map((e) => e.name.toLowerCase() === name.toLowerCase() && e.zone !== "commander" ? {
				...e,
				zone: "nursery"
			} : e)
		};
	}) })),
	promoteFromNursery: (id, name) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		return {
			...d,
			entries: d.entries.map((e) => e.name.toLowerCase() === name.toLowerCase() && e.zone === "nursery" ? {
				...e,
				zone: "main"
			} : e)
		};
	}) })),
	cutCard: (id, name) => set((s) => ({ decks: s.decks.map((d) => {
		if (d.id !== id) return d;
		return {
			...d,
			entries: d.entries.filter((e) => e.name.toLowerCase() !== name.toLowerCase())
		};
	}) })),
	swapIn99: async (id, cutName, addName) => {
		const { cards } = await resolveCardNames({ data: { names: [addName] } });
		const card = Object.values(cards)[0];
		if (!card) {
			set({ error: `Not in the written corpus: ${addName}` });
			return;
		}
		set((s) => ({
			error: null,
			decks: s.decks.map((d) => {
				if (d.id !== id) return d;
				const without = d.entries.filter((e) => e.zone === "nursery" || e.zone === "commander" || e.name.toLowerCase() !== cutName.toLowerCase());
				const entries = without.find((e) => e.name.toLowerCase() === card.name.toLowerCase() && e.zone === "main") ? without : [...without, {
					count: 1,
					name: card.name,
					zone: "main"
				}];
				return {
					...d,
					entries,
					cards: {
						...d.cards,
						[card.name.toLowerCase()]: card
					},
					analysis: d.analysis ? {
						...d.analysis,
						trim: d.analysis.trim.filter((t) => t.name.toLowerCase() !== cutName.toLowerCase()),
						grow: d.analysis.grow.filter((g) => g.name.toLowerCase() !== card.name.toLowerCase())
					} : d.analysis
				};
			})
		}));
	},
	addCardByName: async (id, name, zone = "nursery") => {
		const { cards } = await resolveCardNames({ data: { names: [name] } });
		const card = Object.values(cards)[0];
		if (!card) {
			set({ error: `Not in the written corpus: ${name}` });
			return;
		}
		set((s) => ({
			error: null,
			decks: s.decks.map((d) => {
				if (d.id !== id) return d;
				const exists = d.entries.find((e) => e.name.toLowerCase() === card.name.toLowerCase() && e.zone === zone);
				const entries = exists ? d.entries.map((e) => e === exists ? {
					...e,
					count: e.count + 1
				} : e) : [...d.entries, {
					count: 1,
					name: card.name,
					zone
				}];
				return {
					...d,
					entries,
					cards: {
						...d.cards,
						[card.name.toLowerCase()]: card
					}
				};
			})
		}));
	},
	importList: async (id, raw, packet) => {
		set({
			busy: "Resolving Oracle text…",
			error: null
		});
		try {
			const entries = parseDeckList(raw);
			if (!entries.length) {
				set({
					busy: null,
					error: "No card lines found. Use 1x Name, or section headers like Creature."
				});
				return;
			}
			const { cards, unresolved } = await resolveCardNames({ data: { names: uniqueNames(entries) } });
			const commanderName = detectCommander(entries, cards);
			const format = "commander";
			const soil = analyzeSoil(entries, cards, format);
			const lanes = guessLanes(commanderName, entries, cards);
			const name = commanderName ?? entries[0]?.name ?? "Untitled";
			set((s) => {
				const short = abbreviate(name, takenShorts(s.decks, id));
				return {
					busy: null,
					spine: packet.job === "soil" ? "soil" : "plan",
					decks: s.decks.map((d) => d.id === id ? {
						...d,
						name,
						short,
						rawList: raw,
						entries,
						cards,
						unresolved,
						commanderName,
						format,
						soil,
						analysis: null,
						packet: {
							...d.packet,
							...packet,
							lane: packet.lane ?? lanes[0] ?? null
						}
					} : d)
				};
			});
		} catch (err) {
			set({
				busy: null,
				error: err instanceof Error ? err.message : "Could not resolve that list"
			});
		}
	},
	tend: async (id) => {
		const deck = get().decks.find((d) => d.id === id);
		if (!deck || !deck.entries.length) return;
		set({
			busy: "Looking at the list…",
			error: null
		});
		try {
			let candidates = [];
			if (deck.commanderName) {
				const meta = await fetchCommanderMeta({ data: { commander: deck.commanderName } });
				if (meta.ok) candidates = [
					...meta.high.map((c) => ({
						name: c.name,
						synergy: c.synergy,
						kind: "high"
					})),
					...meta.top.map((c) => ({
						name: c.name,
						synergy: c.synergy,
						kind: "top"
					})),
					...meta.fresh.map((c) => ({
						name: c.name,
						synergy: c.synergy,
						kind: "new"
					}))
				];
			}
			const names = deck.entries.map((e) => {
				const c = lookup(deck.cards, e.name);
				return {
					name: e.name,
					typeLine: c?.typeLine ?? "",
					oracleText: c?.oracleText ?? "",
					cmc: c?.cmc ?? 0,
					zone: e.zone
				};
			});
			const analysis = await tendDeck({ data: {
				commander: deck.commanderName,
				format: deck.format,
				packet: deck.packet,
				names,
				inDeck: uniqueNames(deck.entries),
				candidates
			} });
			const missing = [...analysis.grow.map((g) => g.name), ...analysis.watch.map((w) => w.name)].filter((n) => !lookup(get().decks.find((d) => d.id === id)?.cards ?? {}, n));
			let extraCards = {};
			if (missing.length) extraCards = (await resolveCardNames({ data: { names: missing } })).cards;
			set((s) => ({
				busy: null,
				spine: deck.packet.job === "soil" ? "soil" : "plan",
				decks: s.decks.map((d) => d.id === id ? {
					...d,
					cards: {
						...d.cards,
						...extraCards
					},
					analysis,
					soil: analyzeSoil(d.entries, {
						...d.cards,
						...extraCards
					}, d.format),
					packet: {
						...d.packet,
						lane: d.packet.lane ?? analysis.laneGuess[0] ?? d.packet.lane
					}
				} : d)
			}));
		} catch (err) {
			set({
				busy: null,
				error: err instanceof Error ? err.message : "Tend failed"
			});
		}
	}
}), {
	name: "the-gardener-v1",
	partialize: (s) => ({
		decks: s.decks,
		activeId: s.activeId,
		spine: s.spine
	}),
	skipHydration: true
}));
function identityFor(deck) {
	return colorIdentityOf(deck.commanderName, deck.cards, deck.entries);
}
function DeckTabs() {
	const decks = useGarden((s) => s.decks);
	const activeId = useGarden((s) => s.activeId);
	const setActive = useGarden((s) => s.setActive);
	const addEmptyDeck = useGarden((s) => s.addEmptyDeck);
	const removeDeck = useGarden((s) => s.removeDeck);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 items-end gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex min-w-0 items-end gap-1 overflow-x-auto pb-0",
			children: decks.map((deck) => {
				const on = deck.id === activeId;
				const colors = identityFor(deck);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "group relative",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						title: deck.name,
						onClick: () => setActive(deck.id),
						className: cn("flex min-w-16 flex-col items-center gap-1 rounded-t-md px-3 pb-2 pt-2", on ? "bg-bark text-cream" : "text-mute hover:text-cream"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("font-sans text-xs font-medium tracking-[0.18em]", on && "text-sap"),
								children: deck.short
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManaDots, { colors }),
							on ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute inset-x-3 bottom-0 h-px bg-sap" }) : null
						]
					}), decks.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": `Remove ${deck.name}`,
						onClick: (e) => {
							e.stopPropagation();
							removeDeck(deck.id);
						},
						className: "absolute -right-1 top-0 hidden rounded-full bg-loam p-0.5 text-mute hover:text-nightshade group-hover:block",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
					}) : null]
				}, deck.id);
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
			text: "Add another Commander deck.",
			side: "bottom",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-label": "Add a Commander deck",
				onClick: () => addEmptyDeck(),
				className: "mb-1 flex h-9 w-8 items-center justify-center rounded-md border border-sap/40 text-sap hover:bg-sap hover:text-ink",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "size-4" })
			})
		})]
	});
}
function Chip({ on, hint, children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
		text: hint,
		side: "bottom",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "chip",
			"data-on": on,
			onClick,
			children
		})
	});
}
function Intake({ deckId, compact }) {
	const importList = useGarden((s) => s.importList);
	const tend = useGarden((s) => s.tend);
	const busy = useGarden((s) => s.busy);
	const error = useGarden((s) => s.error);
	const existing = useGarden((s) => s.decks.find((d) => d.id === deckId));
	const [raw, setRaw] = (0, import_react.useState)(compact ? existing?.rawList ?? "" : "");
	const [job, setJob] = (0, import_react.useState)(compact ? existing?.packet.job ?? "diagnose" : "diagnose");
	const [lane, setLane] = (0, import_react.useState)(compact ? existing?.packet.lane ?? null : null);
	const [table, setTable] = (0, import_react.useState)(compact ? existing?.packet.table ?? "hold" : "hold");
	const [fences, setFences] = (0, import_react.useState)(compact ? existing?.packet.fences ?? [] : []);
	const [notes, setNotes] = (0, import_react.useState)(compact ? existing?.packet.driveNotes ?? "" : "");
	async function submit() {
		await importList(deckId, raw, {
			job,
			lane,
			table,
			fences,
			driveNotes: notes
		});
		if (useGarden.getState().decks.find((d) => d.id === deckId)?.entries.length && job !== "soil") await tend(deckId);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex w-full flex-col gap-6", compact ? "max-w-none" : "mx-auto max-w-3xl px-8 py-10"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "space-y-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xs tracking-[0.22em] text-filigree",
						children: compact ? "RESTEER THIS LIST" : "NEW COMMANDER DECK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: cn("font-display text-parchment", compact ? "text-xl" : "text-3xl"),
						children: compact ? "What do you want done now?" : "What do you want done?"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "max-w-xl text-sm leading-relaxed text-mute",
						children: compact ? "Change the job, how it wins, the table, or the drive notes. Look again when you're ready." : "Paste a Commander list. Pick a job, or skip and let us guess. If you already know how it pilots, write that — it outranks the chips."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mb-2 block text-xs tracking-wide text-filigree",
					children: "Decklist"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: raw,
					onChange: (e) => setRaw(e.target.value),
					placeholder: "Commander\n1x The Mimeoplasm\n\nCreature\n1x Birds of Paradise\n...",
					className: cn("w-full resize-y rounded-lg bg-soil px-4 py-3 font-sans text-sm text-cream outline-none ring-1 ring-filigree/25 placeholder:text-mute/70 focus:ring-sap/60", compact ? "h-28" : "h-52")
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-filigree",
					children: "Job"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: JOBS.map((j) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						on: job === j.id,
						hint: j.hint,
						onClick: () => setJob(j.id),
						children: j.label
					}, j.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-filigree",
					children: "How it wins — skip to guess"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: LANES.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						on: lane === l.id,
						hint: l.hint,
						onClick: () => setLane(lane === l.id ? null : l.id),
						children: l.label
					}, l.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-filigree",
					children: "Table"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: TABLES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						on: table === t.id,
						hint: t.hint,
						onClick: () => setTable(t.id),
						children: t.label
					}, t.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-filigree",
					children: "Don't add"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-wrap gap-2",
					children: FENCES.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
						on: fences.includes(f.id),
						hint: f.hint,
						onClick: () => setFences((cur) => cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]),
						children: f.label
					}, f.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "mb-2 block text-xs tracking-wide text-filigree",
					children: "How do you pilot it? (optional)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: notes,
					onChange: (e) => setNotes(e.target.value),
					placeholder: "Prime copies, ancillary fuel, wheels not mill, never copy Dreadnought…",
					className: "h-28 w-full resize-y rounded-lg bg-soil px-4 py-3 text-sm text-cream outline-none ring-1 ring-filigree/25 placeholder:text-mute/70 focus:ring-sap/60"
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-nightshade",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
				text: "Resolve the list against Oracle, then suggest cuts and adds for Commander.",
				side: "bottom",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: !raw.trim() || !!busy,
					onClick: () => void submit(),
					className: cn("self-start rounded-md bg-sap px-5 py-2.5 text-sm font-medium text-ink", "hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"),
					children: busy ?? "Look at this list"
				})
			})
		]
	});
}
var STOP = new Set([
	"How",
	"What",
	"When",
	"Why",
	"Which",
	"Who",
	"Would",
	"Could",
	"Should",
	"Does",
	"Did",
	"Do",
	"If",
	"The",
	"A",
	"An",
	"Your",
	"You",
	"Need",
	"Extra",
	"Last",
	"This",
	"That",
	"Than",
	"Then",
	"With",
	"From",
	"Into",
	"Just",
	"Also",
	"More",
	"Less",
	"Often",
	"Versus",
	"Simply",
	"Copying",
	"Prime",
	"Ditch",
	"Flying",
	"Is",
	"Are",
	"Or",
	"And",
	"For",
	"To",
	"Of",
	"In",
	"On",
	"It",
	"Its",
	"Be",
	"Can",
	"We",
	"They",
	"Still",
	"Really",
	"Only"
].map((w) => w.toLowerCase()));
function needlesFrom(known) {
	const firstCount = /* @__PURE__ */ new Map();
	const firstOfficial = /* @__PURE__ */ new Map();
	for (const name of known) {
		const first = name.split(/\s+/)[0] ?? "";
		if (first.length < 4) continue;
		const k = first.toLowerCase();
		firstCount.set(k, (firstCount.get(k) ?? 0) + 1);
		firstOfficial.set(k, name);
	}
	const out = known.map((name) => ({
		needle: name,
		official: name
	}));
	for (const [k, n] of firstCount) {
		if (n !== 1) continue;
		const official = firstOfficial.get(k);
		if (official.toLowerCase() === k) continue;
		out.push({
			needle: official.split(/\s+/)[0],
			official
		});
	}
	out.sort((a, b) => b.needle.length - a.needle.length);
	return out;
}
function splitCardMentions(text, known) {
	const taken = new Array(text.length).fill(false);
	const hits = [];
	const lower = text.toLowerCase();
	for (const { needle, official } of needlesFrom(known)) {
		const n = needle.toLowerCase();
		let from = 0;
		while (from <= lower.length - n.length) {
			const i = lower.indexOf(n, from);
			if (i < 0) break;
			const end = i + n.length;
			const beforeOk = i === 0 || !/[A-Za-z0-9]/.test(text[i - 1] ?? "");
			const afterOk = end === text.length || !/[A-Za-z0-9]/.test(text[end] ?? "");
			let overlap = false;
			for (let k = i; k < end; k++) if (taken[k]) overlap = true;
			if (beforeOk && afterOk && !overlap) {
				hits.push({
					start: i,
					end,
					name: official
				});
				for (let k = i; k < end; k++) taken[k] = true;
			}
			from = i + 1;
		}
	}
	const cap = /\b[A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+)*/g;
	let m;
	while (m = cap.exec(text)) {
		const start = m.index;
		const end = start + m[0].length;
		if (STOP.has(m[0].toLowerCase())) continue;
		if (start === 0) continue;
		let overlap = false;
		for (let k = start; k < end; k++) if (taken[k]) overlap = true;
		if (overlap) continue;
		hits.push({
			start,
			end,
			name: m[0]
		});
		for (let k = start; k < end; k++) taken[k] = true;
	}
	hits.sort((a, b) => a.start - b.start);
	const parts = [];
	let cursor = 0;
	for (const h of hits) {
		if (h.start > cursor) parts.push({
			text: text.slice(cursor, h.start),
			cardName: null
		});
		parts.push({
			text: text.slice(h.start, h.end),
			cardName: h.name
		});
		cursor = h.end;
	}
	if (cursor < text.length) parts.push({
		text: text.slice(cursor),
		cardName: null
	});
	return parts;
}
var cache = {};
function Mention({ label, lookupName, cards }) {
	const [hover, setHover] = (0, import_react.useState)(null);
	async function show(x, y) {
		const key = lookupName.toLowerCase();
		let card = cards[key] ?? cache[key] ?? void 0;
		if (card === void 0 && cache[key] !== null) {
			const { cards: found } = await resolveCardNames({ data: { names: [lookupName] } });
			card = found[key] ?? Object.values(found)[0];
			cache[key] = card ?? null;
		}
		if (card) setHover({
			card,
			x,
			y
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: "card-mention",
		onMouseEnter: (e) => void show(e.clientX, e.clientY),
		onMouseMove: (e) => {
			if (hover) setHover({
				...hover,
				x: e.clientX,
				y: e.clientY
			});
		},
		onMouseLeave: () => setHover(null),
		children: [label, hover ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHover, {
			card: hover.card,
			x: hover.x,
			y: hover.y
		}) : null]
	});
}
function MentionText({ text, known, cards }) {
	const parts = (0, import_react.useMemo)(() => splitCardMentions(text, known), [text, known]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: parts.map((p, i) => p.cardName ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mention, {
		label: p.text,
		lookupName: p.cardName,
		cards
	}, `${p.cardName}-${i}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: p.text }, i)) });
}
function namesFromDeck(deck) {
	const n = /* @__PURE__ */ new Set();
	for (const c of Object.values(deck.cards)) n.add(c.name);
	for (const e of deck.entries) n.add(e.name);
	if (deck.commanderName) n.add(deck.commanderName);
	for (const t of deck.analysis?.trim ?? []) n.add(t.name);
	for (const g of deck.analysis?.grow ?? []) n.add(g.name);
	for (const w of deck.analysis?.watch ?? []) n.add(w.name);
	return [...n];
}
var TOOLS = [
	{
		id: "plan",
		label: "Review",
		icon: ScrollText,
		hint: "The Gardener's read on this list — how it drives, and what's missing."
	},
	{
		id: "trim",
		label: "Trim",
		icon: Scissors,
		hint: "Cuts from the 99. Over 99, just cut. At 99, each cut comes with a Grow swap for that slot."
	},
	{
		id: "grow",
		label: "Grow",
		icon: Sprout,
		hint: "Cards to add that support your plan. Every name is a real card."
	},
	{
		id: "soil",
		label: "Mana",
		icon: Mountain,
		hint: "Manabase: land count, taplands, and basics your searchers can hit."
	},
	{
		id: "nursery",
		label: "Nursery",
		icon: Flower2,
		hint: "A maybeboard. Not in the 99 until you promote a card."
	},
	{
		id: "watch",
		label: "Watch",
		icon: Eye,
		hint: "New cards, bans, and Game Changers for this commander."
	}
];
function DeckTools({ deck }) {
	const spine = useGarden((s) => s.spine);
	const setSpine = useGarden((s) => s.setSpine);
	const unread = (deck.analysis?.watch.length ?? 0) > 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "shrink-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "tool-bar",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 pb-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-xl text-parchment",
					children: deck.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-mute",
					children: [
						"Commander",
						deck.commanderName ? ` · ${deck.commanderName}` : "",
						deck.packet.lane ? ` · ${deck.packet.lane}` : ""
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "flex items-stretch",
				children: [TOOLS.map((t) => {
					const Icon = t.icon;
					const on = spine === t.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
						text: t.hint,
						side: "bottom",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							"aria-label": `${t.label}. ${t.hint}`,
							"aria-pressed": on,
							onClick: () => setSpine(on ? null : t.id),
							className: cn("tool-tab", on && "is-on"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-4" }),
								t.label,
								t.id === "watch" && unread ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "tool-dot" }) : null
							]
						})
					}, t.id);
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
					text: "Re-open the questionnaire. Change the job, lane, table, or how you pilot it.",
					side: "bottom",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-label": "Re-open the questionnaire",
						"aria-pressed": spine === "intake",
						onClick: () => setSpine(spine === "intake" ? null : "intake"),
						className: cn("tool-tab", spine === "intake" && "is-on"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Recycle, { className: "size-4" }), "Again"]
					})
				})]
			})]
		}), spine ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "tool-drop",
			children: [
				spine === "plan" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReviewPanel, { deck }) : null,
				spine === "trim" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrimPanel, { deck }) : null,
				spine === "grow" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GrowPanel, { deck }) : null,
				spine === "soil" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ManaPanel, { deck }) : null,
				spine === "nursery" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NurseryPanel, { deck }) : null,
				spine === "watch" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WatchPanel, { deck }) : null,
				spine === "intake" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Intake, {
					deckId: deck.id,
					compact: true
				}) : null
			]
		}) : null]
	});
}
function PanelTitle({ title, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "mb-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-display text-lg text-parchment",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 text-xs leading-relaxed text-mute",
			children: hint
		})]
	});
}
function CardThumb({ card, name }) {
	const src = card?.image || card?.imageSmall;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "card-thumb",
		children: src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src,
			alt: name
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: name })
	});
}
function ReviewPanel({ deck }) {
	const tend = useGarden((s) => s.tend);
	const renameDeck = useGarden((s) => s.renameDeck);
	const renameShort = useGarden((s) => s.renameShort);
	const patchPacket = useGarden((s) => s.patchPacket);
	const busy = useGarden((s) => s.busy);
	const draw = countRole(deck.entries, deck.cards, roleTests.draw);
	const ramp = countRole(deck.entries, deck.cards, roleTests.ramp);
	const interaction = countRole(deck.entries, deck.cards, roleTests.interaction);
	const tool = TOOLS.find((t) => t.id === "plan");
	const feedback = deck.packet.feedback ?? "";
	const answers = deck.packet.answers ?? {};
	const questions = deck.analysis?.questions ?? [];
	const known = namesFromDeck(deck);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-4 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Review",
				hint: tool.hint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block min-w-48 flex-1 space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-mute",
						children: "Full name"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: deck.name,
						onChange: (e) => renameDeck(deck.id, e.target.value),
						className: "w-full rounded-md bg-soil px-2 py-1.5 text-cream outline-none ring-1 ring-filigree/20"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-mute",
						children: "Tab (5)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: deck.short,
						maxLength: 5,
						onChange: (e) => renameShort(deck.id, e.target.value),
						className: "w-24 rounded-md bg-soil px-2 py-1.5 tracking-[0.2em] text-cream outline-none ring-1 ring-filigree/20"
					})]
				})]
			}),
			deck.analysis?.diagnosis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-md bg-soil p-3 leading-relaxed text-cream/90",
				children: deck.analysis.diagnosis
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "No opinion yet. Look at the list and the Gardener will write one."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-mute",
				children: [
					"Draw ",
					draw,
					" · Ramp ",
					ramp,
					" · Interaction ",
					interaction,
					deck.packet.lane ? ` · ${deck.packet.lane}` : "",
					deck.packet.table ? ` · ${deck.packet.table}` : ""
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs tracking-wide text-filigree",
						children: "Feedback"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-mute",
						children: "If the read is wrong, say so. This outranks the last diagnosis."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: feedback,
						onChange: (e) => patchPacket(deck.id, { feedback: e.target.value }),
						placeholder: "Too much voltron — it's bird tribal with a strong commander.",
						className: "h-24 w-full rounded-md bg-soil px-2 py-1.5 text-sm text-cream outline-none ring-1 ring-filigree/20 placeholder:text-mute"
					})
				]
			}),
			questions.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-wide text-filigree",
					children: "Questions"
				}), questions.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block space-y-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-xs text-parchment",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MentionText, {
							text: q,
							known,
							cards: deck.cards
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: answers[q] ?? "",
						onChange: (e) => patchPacket(deck.id, { answers: {
							...answers,
							[q]: e.target.value
						} }),
						placeholder: "Your answer",
						className: "h-16 w-full rounded-md bg-soil px-2 py-1.5 text-sm text-cream outline-none ring-1 ring-filigree/20 placeholder:text-mute"
					})]
				}, q))]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
				text: "Re-run cuts and adds using your feedback and answers.",
				side: "bottom",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: !!busy || !deck.entries.length,
					onClick: () => void tend(deck.id),
					className: "rounded-md bg-sap px-3 py-2 text-sm font-medium text-ink disabled:opacity-40",
					children: busy ?? "Look again"
				})
			}),
			deck.analysis ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: deck.analysis.usedAi ? "Oracle + EDHREC" : "Oracle + EDHREC (no AI this pass)"
			}) : null
		]
	});
}
function TrimPanel({ deck }) {
	const cutCard = useGarden((s) => s.cutCard);
	const toggleLock = useGarden((s) => s.toggleLock);
	const moveToNursery = useGarden((s) => s.moveToNursery);
	const argueKeep = useGarden((s) => s.argueKeep);
	const swapIn99 = useGarden((s) => s.swapIn99);
	const main = new Set(deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name.toLowerCase()));
	const mainCount = deck.entries.filter((e) => e.zone !== "nursery").reduce((n, e) => n + e.count, 0);
	const items = (deck.analysis?.trim ?? []).filter((v) => main.has(v.name.toLowerCase()));
	const swaps = trimSwaps(deck);
	const [drafts, setDrafts] = (0, import_react.useState)({});
	const tool = TOOLS.find((t) => t.id === "trim");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Trim",
				hint: tool.hint
			}),
			!items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "Nothing flagged. Look from Review, or this list already matches."
			}) : null,
			mainCount > 99 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-filigree",
				children: [mainCount, " cards in the 99 — cuts can stand alone until you hit 99."]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tool-cards",
				children: items.map((v) => {
					const card = lookup(deck.cards, v.name);
					const swap = swaps.get(v.name);
					const swapCard = swap ? lookup(deck.cards, swap.name) : void 0;
					const saved = deck.packet.defenses?.[v.name] ?? "";
					const draft = drafts[v.name] ?? saved;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: cn("tool-card", swap && "has-swap"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "swap-arts",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
								card,
								name: v.name
							}), swap ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, { className: "swap-arrow" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
								card: swapCard,
								name: swap.name
							})] }) : null]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "tool-copy",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: v.kind === "weed" ? "text-nightshade" : "text-filigree",
									children: [v.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-2 text-xs uppercase tracking-wide",
										children: v.kind === "weed" ? "off-plan" : "check"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs leading-relaxed text-cream/80",
									children: v.reason
								}),
								swap ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-xs leading-relaxed text-sap",
									children: [
										"Swap in ",
										swap.name,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "ml-1.5 uppercase tracking-wide text-mute",
											children: swap.role
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mt-1 block text-cream/80",
											children: swap.reason
										})
									]
								}) : mainCount <= 99 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-mute",
									children: "No on-plan Grow card for this slot yet. Look again after you restock Grow."
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: [
										swap ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
											text: "Cut this from the 99 and put the Grow card in its place.",
											side: "bottom",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "chip",
												"data-on": "true",
												onClick: () => void swapIn99(deck.id, v.name, swap.name),
												children: "Swap"
											})
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "chip",
											onClick: () => cutCard(deck.id, v.name),
											children: "Cut"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
											text: "Move to the maybeboard. Not in the 99 until you promote it.",
											side: "bottom",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "chip",
												onClick: () => moveToNursery(deck.id, v.name),
												children: "Nursery"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
											text: "Keep this card. Don't suggest cutting it again.",
											side: "bottom",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "chip",
												onClick: () => toggleLock(deck.id, v.name),
												children: "Lock"
											})
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
									className: "mt-3 block space-y-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs text-mute",
										children: "Argue why this stays"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
										value: draft,
										onChange: (e) => setDrafts((cur) => ({
											...cur,
											[v.name]: e.target.value
										})),
										placeholder: "It's a Prime copy / the discard outlet / the only free sac…",
										className: "h-16 w-full rounded-md bg-mulch px-2 py-1.5 text-xs text-cream outline-none ring-1 ring-filigree/20"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "chip mt-1.5",
									"data-on": Boolean(saved),
									disabled: !draft.trim(),
									onClick: () => argueKeep(deck.id, v.name, draft),
									children: saved ? "Update argument" : "Keep — here's why"
								})
							]
						})]
					}, v.name);
				})
			})
		]
	});
}
function GrowPanel({ deck }) {
	const addCardByName = useGarden((s) => s.addCardByName);
	const toggleNever = useGarden((s) => s.toggleNever);
	const trim = deck.analysis?.trim ?? [];
	const items = (deck.analysis?.grow ?? []).filter((s) => {
		const card = lookup(deck.cards, s.name);
		if (!card?.oracleText) return true;
		return !contradictsCuts(card, trim);
	});
	const tool = TOOLS.find((t) => t.id === "grow");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Grow",
				hint: tool.hint
			}),
			!items.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "No candidates yet. Look from Review."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tool-cards",
				children: items.map((s) => {
					const card = lookup(deck.cards, s.name);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "tool-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
							card,
							name: s.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "tool-copy",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sap",
									children: s.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs uppercase tracking-wide text-mute",
									children: s.role
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs leading-relaxed text-cream/80",
									children: s.reason
								}),
								card?.oracleText ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 line-clamp-3 text-xs text-parchment/80",
									children: card.oracleText
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-2 text-xs text-mute",
									children: "Oracle loads when you add it."
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											className: "chip",
											"data-on": "true",
											onClick: () => void addCardByName(deck.id, s.name, "main"),
											children: "Add"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
											text: "Park it on the maybeboard instead of the 99.",
											side: "bottom",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "chip",
												onClick: () => void addCardByName(deck.id, s.name, "nursery"),
												children: "Nursery"
											})
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Hint, {
											text: "Don't suggest this card for this deck again.",
											side: "bottom",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
												type: "button",
												className: "chip",
												onClick: () => toggleNever(deck.id, s.name),
												children: "Never"
											})
										})
									]
								})
							]
						})]
					}, s.name);
				})
			})
		]
	});
}
function ManaPanel({ deck }) {
	const soil = deck.soil;
	const tool = TOOLS.find((t) => t.id === "soil");
	if (!soil) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-mute",
		children: "Paste a list to read the manabase."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Mana",
				hint: tool.hint
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-display text-2xl text-parchment",
				children: [soil.landCount, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "ml-2 text-sm text-mute",
					children: [
						"target ",
						soil.targetMin,
						"–",
						soil.targetMax
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs leading-relaxed text-cream/85",
				children: soil.rationale
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: soil.basicNeed
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs",
				children: [
					"Basics W",
					soil.basics.W,
					" U",
					soil.basics.U,
					" B",
					soil.basics.B,
					" R",
					soil.basics.R,
					" G",
					soil.basics.G
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs",
				children: [
					"Taplands ",
					soil.taplands.length,
					" / budget ",
					soil.tapBudget
				]
			}),
			soil.taplands.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: soil.taplands.join(", ")
			}) : null,
			soil.searchers.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "space-y-1 text-xs",
				children: soil.searchers.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-filigree",
					children: s.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-mute",
					children: [" — ", s.needs]
				})] }, s.name))
			}) : null,
			soil.colorHoles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "text-xs text-nightshade",
				children: soil.colorHoles.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: h }, h))
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-mute",
				children: "Colored sources look healthy."
			}),
			soil.add.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-sap",
				children: soil.add.join(" ")
			}) : null
		]
	});
}
function NurseryPanel({ deck }) {
	const promoteFromNursery = useGarden((s) => s.promoteFromNursery);
	const cutCard = useGarden((s) => s.cutCard);
	const setRole = useGarden((s) => s.setRole);
	const rows = deck.entries.filter((e) => e.zone === "nursery");
	const tool = TOOLS.find((t) => t.id === "nursery");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Nursery",
				hint: tool.hint
			}),
			!rows.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "Empty. Watch and Grow land here first."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tool-cards",
				children: rows.map((r) => {
					const card = lookup(deck.cards, r.name);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "tool-card",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
							card,
							name: r.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "tool-copy",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-parchment",
									children: [
										r.count,
										"x ",
										r.name
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-mute",
									children: card?.typeLine
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 flex flex-wrap gap-1.5",
									children: [
										"Prime",
										"Ancillary",
										"Utility",
										"Hat"
									].map((role) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "chip",
										"data-on": deck.packet.customRoles[r.name] === role,
										onClick: () => setRole(deck.id, r.name, deck.packet.customRoles[r.name] === role ? null : role),
										children: role
									}, role))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-2 flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "chip",
										"data-on": "true",
										onClick: () => promoteFromNursery(deck.id, r.name),
										children: "Promote"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "chip",
										onClick: () => cutCard(deck.id, r.name),
										children: "Drop"
									})]
								})
							]
						})]
					}, r.name);
				})
			})
		]
	});
}
function WatchPanel({ deck }) {
	const addCardByName = useGarden((s) => s.addCardByName);
	const gcs = deck.entries.filter((e) => GAME_CHANGERS.has(e.name.toLowerCase()));
	const banned = deck.entries.filter((e) => lookup(deck.cards, e.name)?.legalities.commander === "banned");
	const items = deck.analysis?.watch ?? [];
	const tool = TOOLS.find((t) => t.id === "watch");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3 text-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelTitle, {
				title: "Watch",
				hint: tool.hint
			}),
			banned.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "tool-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
					card: lookup(deck.cards, e.name),
					name: e.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-nightshade",
					children: ["Banned in Commander: ", e.name]
				})]
			}, e.name)),
			gcs.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "tool-card",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
					card: lookup(deck.cards, e.name),
					name: e.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-filigree",
					children: ["Game Changer in the list: ", e.name]
				})]
			}, e.name)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tool-cards",
				children: items.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "tool-card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardThumb, {
						card: lookup(deck.cards, w.name),
						name: w.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "tool-copy",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sap",
								children: w.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-mute",
								children: w.note
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "chip mt-2",
								onClick: () => void addCardByName(deck.id, w.name, "nursery"),
								children: "To nursery"
							})
						]
					})]
				}, w.id))
			}),
			!items.length && !gcs.length && !banned.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-mute",
				children: "Quiet. Look from Review to pull new EDHREC cards for this commander."
			}) : null
		]
	});
}
function GardenerApp() {
	const decks = useGarden((s) => s.decks);
	const activeId = useGarden((s) => s.activeId);
	const addEmptyDeck = useGarden((s) => s.addEmptyDeck);
	const busy = useGarden((s) => s.busy);
	const error = useGarden((s) => s.error);
	(0, import_react.useEffect)(() => {
		Promise.resolve(useGarden.persist.rehydrate());
	}, []);
	const deck = decks.find((d) => d.id === activeId) ?? decks[0] ?? null;
	const empty = !deck || deck.entries.length === 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-screen min-h-0 flex-col bg-soil text-cream",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-end gap-6 border-b border-filigree/20 px-4 pt-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-2 shrink-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-lg tracking-[0.18em] text-parchment",
							children: "THE GARDENER"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[10px] tracking-[0.16em] text-mute",
							children: "COMMANDER DECK TENDER"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeckTabs, {}),
					busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 ml-auto text-xs text-sap",
						children: busy
					}) : null,
					error && !empty ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 ml-auto text-xs text-nightshade",
						children: error
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1 flex-col",
				children: [
					empty && deck ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Intake, { deckId: deck.id }) : null,
					empty && !deck ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex h-full items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "chip",
							"data-on": "true",
							onClick: () => addEmptyDeck(),
							children: "New deck"
						})
					}) : null,
					!empty && deck ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeckTools, { deck }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: "min-h-0 min-w-0 flex-1",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeckList, { deck })
					})] }) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "border-t border-filigree/15 px-4 py-1 text-[10px] tracking-wide text-mute",
				children: "Card data © Wizards of the Coast · Oracle via Scryfall · Commander recs via EDHREC · Fan content, unofficial"
			})
		]
	});
}
var SplitComponent = GardenerApp;
//#endregion
export { SplitComponent as component };
