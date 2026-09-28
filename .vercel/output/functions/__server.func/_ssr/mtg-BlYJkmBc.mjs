import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { n as sleep } from "./utils-DaIbQSVg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mtg-BlYJkmBc.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var UA = "TheGardener/1.0 (MTG deck tender)";
var SCRY = "https://api.scryfall.com";
var EDH = "https://json.edhrec.com/pages";
async function scryfall(path, init) {
	return await fetch(`${SCRY}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			"User-Agent": UA,
			...init?.headers ?? {}
		}
	});
}
function slim(card) {
	const faces = card.card_faces ?? [];
	const face0 = faces[0];
	const imageUris = card.image_uris ?? face0?.image_uris;
	const backUris = faces[1]?.image_uris;
	const oracle = card.oracle_text ?? faces.map((f) => String(f.oracle_text ?? "")).filter(Boolean).join("\n//\n") ?? "";
	const typeLine = card.type_line ?? faces.map((f) => String(f.type_line ?? "")).filter(Boolean).join(" // ") ?? "";
	return {
		oracleId: String(card.oracle_id ?? face0?.oracle_id ?? card.id ?? ""),
		name: String(card.name ?? ""),
		typeLine,
		oracleText: oracle,
		manaCost: String(card.mana_cost ?? face0?.mana_cost ?? ""),
		cmc: Number(card.cmc ?? 0),
		colors: card.colors ?? face0?.colors ?? [],
		colorIdentity: card.color_identity ?? [],
		producedMana: card.produced_mana ?? [],
		keywords: card.keywords ?? [],
		power: card.power ?? face0?.power ?? null,
		toughness: card.toughness ?? face0?.toughness ?? null,
		legalities: card.legalities ?? {},
		image: imageUris?.normal ?? imageUris?.large ?? null,
		imageSmall: imageUris?.small ?? imageUris?.normal ?? null,
		imageBack: backUris?.normal ?? null,
		releasedAt: card.released_at ?? null
	};
}
async function named(name) {
	const exact = await scryfall(`/cards/named?exact=${encodeURIComponent(name)}`);
	if (exact.ok) return slim(await exact.json());
	await sleep(80);
	const fuzzy = await scryfall(`/cards/named?fuzzy=${encodeURIComponent(name)}`);
	if (fuzzy.ok) return slim(await fuzzy.json());
	return null;
}
var resolveCardNames_createServerFn_handler = createServerRpc({
	id: "0616887fd5a1dc88df87409997de362ed30e6b3b75cb4c553ba05ee7c28f129d",
	name: "resolveCardNames",
	filename: "src/lib/server/mtg.ts"
}, (opts) => resolveCardNames.__executeServer(opts));
var resolveCardNames = createServerFn({ method: "POST" }).validator((data) => data).handler(resolveCardNames_createServerFn_handler, async ({ data }) => {
	const unique = [...new Set(data.names.map((n) => n.trim()).filter(Boolean))];
	const found = [];
	const unresolved = [];
	for (let i = 0; i < unique.length; i += 75) {
		const chunk = unique.slice(i, i + 75);
		const res = await scryfall("/cards/collection", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) })
		});
		if (!res.ok) {
			unresolved.push(...chunk);
			continue;
		}
		const body = await res.json();
		for (const card of body.data ?? []) found.push(slim(card));
		for (const miss of body.not_found ?? []) if (miss.name) unresolved.push(miss.name);
		if (i + 75 < unique.length) await sleep(90);
	}
	const recovered = [];
	for (const name of unresolved) {
		await sleep(80);
		const card = await named(name);
		if (card) {
			found.push(card);
			recovered.push(name);
		}
	}
	const still = unresolved.filter((n) => !recovered.includes(n));
	const byName = {};
	for (const c of found) byName[c.name.toLowerCase()] = c;
	return {
		cards: byName,
		unresolved: still
	};
});
function slugify(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function collectEdh(json) {
	const high = [];
	const top = [];
	const fresh = [];
	const lists = (json.container?.json_dict ?? json).cardlists ?? [];
	for (const list of lists) {
		const tag = (list.tag ?? list.header ?? "").toLowerCase();
		const views = list.cardviews ?? [];
		if (tag.includes("highsynergy") || tag.includes("high synergy")) high.push(...views);
		else if (tag.includes("newcard") || tag.includes("new card")) fresh.push(...views);
		else if (tag.includes("topcard") || tag.includes("top card")) top.push(...views);
	}
	return {
		high,
		top,
		fresh
	};
}
var fetchCommanderMeta_createServerFn_handler = createServerRpc({
	id: "b1642393a748faffb667e3b326bc29e5b67d56173134c94e37d0b011842f8264",
	name: "fetchCommanderMeta",
	filename: "src/lib/server/mtg.ts"
}, (opts) => fetchCommanderMeta.__executeServer(opts));
var fetchCommanderMeta = createServerFn({ method: "POST" }).validator((data) => data).handler(fetchCommanderMeta_createServerFn_handler, async ({ data }) => {
	const slug = slugify(data.commander);
	const res = await fetch(`${EDH}/commanders/${slug}.json`, { headers: {
		Accept: "application/json",
		"User-Agent": UA
	} });
	if (!res.ok) return {
		ok: false,
		high: [],
		top: [],
		fresh: []
	};
	const { high, top, fresh } = collectEdh(await res.json());
	return {
		ok: true,
		high,
		top,
		fresh
	};
});
function parseAiJson(text) {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(text.slice(start, end + 1));
	} catch {
		return null;
	}
}
var tendDeck_createServerFn_handler = createServerRpc({
	id: "94c3b0a223a4674084035a9092bdca7cbb83abd9474e3440670929c26bfda5d6",
	name: "tendDeck",
	filename: "src/lib/server/mtg.ts"
}, (opts) => tendDeck.__executeServer(opts));
var tendDeck = createServerFn({ method: "POST" }).validator((data) => data).handler(tendDeck_createServerFn_handler, async ({ data }) => {
	const allowed = new Set(data.candidates.map((c) => c.name.toLowerCase()));
	const inDeck = new Set(data.inDeck.map((n) => n.toLowerCase()));
	const never = new Set(data.packet.neverNames.map((n) => n.toLowerCase()));
	const locked = new Set(data.packet.lockedNames.map((n) => n.toLowerCase()));
	const growFromMeta = data.candidates.filter((c) => c.kind === "high" && !inDeck.has(c.name.toLowerCase()) && !never.has(c.name.toLowerCase())).slice(0, 12).map((c) => ({
		name: c.name,
		reason: `EDHREC high synergy with ${data.commander ?? "this commander"}`,
		role: "synergy",
		synergy: c.synergy,
		inEdhrec: true
	}));
	const watch = data.candidates.filter((c) => c.kind === "new" && !inDeck.has(c.name.toLowerCase())).slice(0, 10).map((c) => ({
		id: `new-${c.name}`,
		kind: "new",
		name: c.name,
		note: "Showing up in new EDHREC lists for this commander"
	}));
	const apiKey = process.env.XAI_API_KEY;
	let usedAi = false;
	let diagnosis = "";
	let laneGuess = [];
	let trim = [];
	let grow = growFromMeta;
	let questions = [];
	if (apiKey) {
		const compact = data.names.slice(0, 120).map((c) => `${c.zone === "nursery" ? "[N]" : ""}${c.name} | ${c.typeLine} | CMC ${c.cmc} | ${c.oracleText.replace(/\n/g, " ").slice(0, 220)}`).join("\n");
		const candidateBlock = data.candidates.slice(0, 40).map((c) => `${c.name} [${c.kind}${c.synergy != null ? ` syn=${c.synergy.toFixed(2)}` : ""}]`).join("\n");
		const prompt = `You are The Gardener, a Magic: The Gathering deck tender.
You may ONLY mention cards that appear in DECK or CANDIDATES. Never invent a card. If nothing fits, say so.
If a card's Oracle text does not do what you claim, do not suggest it.

Job: ${data.packet.job ?? "diagnose"}
Lane: ${data.packet.lane ?? "unknown"}
Table: ${data.packet.table ?? "hold"}
Fences: ${data.packet.fences.join(", ") || "none"}
Drive notes (outrank everything else):
${data.packet.driveNotes || "(none)"}
Pilot feedback — if this disagrees with your last diagnosis, YOU are wrong, they are right. Drop the old lane:
${data.packet.feedback || "(none)"}
Answered questions:
${Object.entries(data.packet.answers ?? {}).filter(([, a]) => a.trim()).map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n") || "(none)"}
Pilot arguments for keeping cards:
${Object.entries(data.packet.defenses ?? {}).map(([n, r]) => `${n}: ${r}`).join("\n") || "none"}
Locked (never cut): ${data.packet.lockedNames.join(", ") || "none"}
Never add: ${data.packet.neverNames.join(", ") || "none"}
Commander: ${data.commander ?? "none"}
Format: ${data.format}

DECK (Oracle text is the only rules truth):
${compact}

CANDIDATES (the only names you may add):
${candidateBlock}

Return ONLY JSON:
{
  "diagnosis": "2-5 sentences, how to drive this deck",
  "laneGuess": ["voltron"|"wide"|"combo"|"control"|"alt"|"toolbox"|"value"],
  "trim": [{"name":"exact deck name","kind":"weed"|"question","reason":"why vs the thesis","replaceWith":"exact candidate name or omit"}],
  "grow": [{"name":"exact candidate name","reason":"why this thesis","role":"draw|ramp|interaction|wincon|synergy"}],
  "questions": ["at most 2 specialist questions"]
}
Rules: do not rebuild a competitive list that has drive notes. Steward, don't surgeon. Prefer sidegrades. Empty grow is allowed. Never trim nursery/sideboard cards (names marked [N]) — Trim is the 99 only. replaceWith is optional and MUST fill the same slot from Oracle text: a board wipe only for a board wipe, a counter for a counter, a dork for a dork, a land for a land. NEVER replace a wipe with a creature, a spell with a creature, or a counter with ramp. If CANDIDATES has nothing in that slot, omit replaceWith. If the list is over 99, replaceWith may be omitted (just cut). Never invent a name.
Be internally consistent. If you cut a card because it discards, mills, takes extra turns, or skips untaps, do not grow or replaceWith a card whose Oracle does that same thing. If two suggestions disagree, drop the add and keep the cut. Drive notes and pilot feedback outrank: if they say tribal not voltron, stop treating it as voltron. If the pilot wants discard, do not trim cards for discarding. Do not repeat questions they already answered.`;
		try {
			const res = await fetch("https://api.x.ai/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: "grok-4.5",
					max_tokens: 1800,
					temperature: .3,
					messages: [{
						role: "user",
						content: prompt
					}]
				})
			});
			if (res.ok) {
				const parsed = parseAiJson((await res.json()).choices?.[0]?.message?.content ?? "");
				if (parsed) {
					usedAi = true;
					diagnosis = parsed.diagnosis ?? "";
					laneGuess = parsed.laneGuess ?? [];
					questions = parsed.questions ?? [];
					const mainNames = new Set(data.names.filter((c) => c.zone !== "nursery").map((c) => c.name.toLowerCase()));
					trim = (parsed.trim ?? []).filter((t) => mainNames.has(t.name.toLowerCase()) && !locked.has(t.name.toLowerCase())).map((t) => {
						const key = (t.replaceWith?.trim())?.toLowerCase() ?? "";
						const canon = key && allowed.has(key) && !inDeck.has(key) && !never.has(key) ? data.candidates.find((c) => c.name.toLowerCase() === key)?.name : void 0;
						return {
							name: t.name,
							kind: t.kind,
							reason: t.reason,
							replaceWith: canon
						};
					});
					const aiGrow = (parsed.grow ?? []).filter((g) => allowed.has(g.name.toLowerCase()) && !inDeck.has(g.name.toLowerCase()));
					const named = new Set(aiGrow.map((g) => g.name.toLowerCase()));
					grow = [...aiGrow.map((g) => ({
						...g,
						inEdhrec: true
					})), ...growFromMeta.filter((g) => !named.has(g.name.toLowerCase()))].slice(0, 14);
				}
			}
		} catch {
			usedAi = false;
		}
	}
	if (!diagnosis) diagnosis = data.packet.driveNotes ? "Using your drive notes as the seed packet. Soil, nursery, and EDHREC candidates are ready — I will not rebuild this list." : `Parsed ${data.inDeck.length} unique cards. ${data.commander ? `Commander: ${data.commander}.` : "No commander tagged."} Open Review after a Look, or recycle the questionnaire.`;
	return {
		diagnosis,
		laneGuess,
		trim,
		grow,
		watch,
		questions,
		generatedAt: Date.now(),
		usedAi
	};
});
//#endregion
export { fetchCommanderMeta_createServerFn_handler, resolveCardNames_createServerFn_handler, tendDeck_createServerFn_handler };
