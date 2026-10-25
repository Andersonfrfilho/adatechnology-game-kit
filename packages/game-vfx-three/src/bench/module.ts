import type * as THREE_NS from "three";
import type {
  BenchChange,
  BenchSheet,
  ChoiceOption,
  EffectHandle,
  EffectSink,
  ModuleControl,
  ModuleHost,
  ModuleLayer,
  ModuleMetric,
  TestableModule,
} from "@adatechnology/game-contracts";
import {
  EVENT_BUDGET,
  EXPLOSIONS,
  GAME_EFFECTS,
  estimateCost,
  resolveStrings,
} from "@adatechnology/game-vfx";
import type { EffectDef, ExplosionDef } from "@adatechnology/game-vfx";
import { createVfxRenderer, VFX_LAYERS } from "../renderer";
import type { ThreeLib, VfxRenderer } from "../types";
import { benchText } from "./text";

export interface VfxTestModuleOptions {
  readonly locale?: string;
  /** The recipes the bench lists (default `GAME_EFFECTS`) and the explosions (default `EXPLOSIONS`). */
  readonly effects?: Readonly<Record<string, EffectDef>>;
  readonly explosions?: Readonly<Record<string, ExplosionDef>>;
  /** Seconds between two replays while `auto_repeat` is on. */
  readonly repeatSeconds?: number;
}

const DEFAULT_EFFECT = "m67";
/** The profile the Lab falls back to for an unknown explosive: not something to pick. */
const FALLBACK_EXPLOSION = "generic";
const NO_VARIANT = "none";
const BLAST_POINT: readonly [number, number, number] = [0, 0.1, 0];
const DEFAULT_DISTANCE = 14;
const DEFAULT_REPEAT_SECONDS = 4;
const LIGHT_BUDGET = EVENT_BUDGET.blastLights + EVENT_BUDGET.fireLights;
const SEGMENT_COLORS = ["#ffb347", "#ff7a2a", "#8a8f98", "#5c6370"] as const;

const TEAMS = [
  "creatures",
  "weapons",
  "destruction",
  "world",
  "vehicles",
  "screen",
] as const;
const LAYER_ID = "show_";

const humanize = (id: string): string => id.replace(/_/g, " ");

/** Where the bench stands for a distance (m): a three-quarter view that keeps the blast in frame. */
const eyeFor = (distance: number): [number, number, number] => [
  distance * 0.6,
  distance * 0.35 + 1.4,
  distance * 0.8,
];

/** The tick marks and segments of a sheet's timeline: an explosion's flash, fireball and smoke, or a recipe's time. */
function timelineOf(
  explosion: ExplosionDef | undefined,
  recipe: EffectDef | undefined,
  metric: string,
): NonNullable<BenchSheet["timeline"]> {
  if (explosion) {
    const flash = explosion.flash.life ?? 0.2;
    const smoke = Math.max(explosion.smoke.life, 1);
    return {
      segments: [
        { name: "flash", start: 0, end: flash, color: SEGMENT_COLORS[0] },
        {
          name: "fireball",
          start: 0,
          end: Math.min(smoke, 2.4),
          color: SEGMENT_COLORS[1],
        },
        { name: "smoke", start: 0.4, end: smoke, color: SEGMENT_COLORS[2] },
      ],
      ticks: Array.from({ length: Math.ceil(smoke) }, (_, index) => index + 1),
      metric,
    };
  }
  const span = recipe?.loop && recipe.loop > 0 ? recipe.loop : 4;
  return {
    segments: [
      { name: recipe?.id ?? "", start: 0, end: span, color: SEGMENT_COLORS[1] },
    ],
    ticks: Array.from({ length: Math.floor(span) }, (_, index) => index + 1),
    metric,
  };
}

/**
 * The effects bench: pick an explosion or a recipe (listed by team), its variant, the distance, the quality and the layers, replay it or let it repeat,
 * and watch the particle and light counters against the budget. It plays through `host.effects` (the room's world) and, in a host without one, draws
 * into a renderer of its own.
 */
export function createVfxTestModule(
  options: VfxTestModuleOptions = {},
): TestableModule {
  const locale = options.locale ?? "en";
  const recipes = options.effects ?? GAME_EFFECTS;
  const explosions = options.explosions ?? EXPLOSIONS;
  const text = benchText(locale);
  const strings = resolveStrings(locale);

  const effectOptions = (): ChoiceOption[] => [
    ...Object.keys(explosions)
      .filter((id) => id !== FALLBACK_EXPLOSION)
      .map((id) => ({
        id,
        name: humanize(id),
        group: strings.groups.explosions ?? text.sheet.explosion,
      })),
    // an id the explosions already use is the explosion's: the sink tries the explosions first, so the recipe of the same name could not be reached
    ...TEAMS.flatMap((team) =>
      Object.values(recipes)
        .filter((def) => def.team === team && !(def.id in explosions))
        .map((def) => ({
          id: def.id,
          name: strings.effects[def.id]?.name ?? humanize(def.id),
          group: strings.groups[def.team] ?? def.team,
        })),
    ),
  ];

  const sheetFor = (id: string): BenchSheet => {
    const explosion = explosions[id];
    if (explosion) {
      return {
        kicker: strings.groups.explosions ?? text.sheet.explosion,
        title: humanize(id),
        facts: [
          { label: text.sheet.lethal, value: `${explosion.lethal} m` },
          { label: text.sheet.injury, value: `${explosion.injury} m` },
          { label: text.sheet.radius, value: `${explosion.visualRadius} m` },
          { label: text.sheet.fireballs, value: String(explosion.fireballs) },
          {
            label: text.sheet.particles,
            value: `${estimateCost(explosion)} / ${EVENT_BUDGET.particles}`,
          },
        ],
        timeline: timelineOf(explosion, undefined, "blast_time"),
      };
    }
    const recipe = recipes[id];
    const words = strings.effects[id];
    const labels = strings.sheet;
    return {
      kicker: recipe ? (strings.groups[recipe.team] ?? recipe.team) : undefined,
      title: words?.name ?? humanize(id),
      ...(words ? { body: words.short } : {}),
      facts: words
        ? [{ label: labels.budget, value: `${words.cost} · ${words.costNote}` }]
        : [],
      steps: words
        ? [
            { at: labels.when, text: words.when },
            { at: labels.look, text: words.look },
            { at: labels.budget, text: words.budget },
            { at: labels.network, text: words.network },
          ]
        : [],
      timeline: timelineOf(undefined, recipe, "phase"),
    };
  };

  const controls = (): ModuleControl[] => [
    {
      kind: "choice",
      id: "effect",
      name: text.controls.effect,
      options: effectOptions(),
      default:
        DEFAULT_EFFECT in explosions ? DEFAULT_EFFECT : effectOptions()[0]!.id,
    },
    {
      kind: "choice",
      id: "variant",
      name: text.controls.variant,
      options: [{ id: NO_VARIANT, name: text.none }],
      default: NO_VARIANT,
      hidden: true,
    },
    { kind: "action", id: "replay", name: text.controls.replay },
    {
      kind: "boolean",
      id: "auto_repeat",
      name: text.controls.auto_repeat,
      default: false,
    },
    {
      kind: "number",
      id: "distance",
      name: text.controls.distance,
      min: 4,
      max: 120,
      step: 1,
      unit: "m",
      default: DEFAULT_DISTANCE,
    },
    {
      kind: "choice",
      id: "lod_band",
      name: text.controls.lod_band,
      options: (["auto", "near", "middle", "far"] as const).map((id) => ({
        id,
        name: text.lod[id],
      })),
      default: "auto",
    },
    {
      kind: "choice",
      id: "quality",
      name: text.controls.quality,
      options: (["high", "medium", "low"] as const).map((id) => ({
        id,
        name: text.quality[id],
      })),
      default: "high",
    },
  ];

  const layers = (): ModuleLayer[] =>
    VFX_LAYERS.map((id) => ({ id: `${LAYER_ID}${id}`, name: text.layers[id] }));

  /** The live counters: shared by `metrics` and filled by `attach` (a module without a host reads zeros). */
  let read: () => {
    stats: Readonly<Record<string, number>>;
    phase: number;
    budget: number;
  } = () => ({ stats: {}, phase: 0, budget: 0 });

  const metrics = (): ModuleMetric[] => [
    {
      id: "puffs",
      name: text.metrics.puffs,
      digits: 0,
      read: () => read().stats.puffs ?? 0,
    },
    {
      id: "sparks",
      name: text.metrics.sparks,
      digits: 0,
      read: () => read().stats.sparks ?? 0,
    },
    {
      id: "debris",
      name: text.metrics.debris,
      digits: 0,
      max: EVENT_BUDGET.debris,
      read: () => read().stats.chunks ?? 0,
    },
    {
      id: "lights",
      name: text.metrics.lights,
      digits: 0,
      max: LIGHT_BUDGET,
      read: () =>
        (read().stats.blastLights ?? 0) + (read().stats.fireLights ?? 0),
    },
    {
      id: "budget_particles",
      name: text.metrics.budget_particles,
      digits: 0,
      max: EVENT_BUDGET.particles,
      read: () => read().budget,
    },
    {
      id: "lod",
      name: text.metrics.lod,
      digits: 2,
      read: () => read().stats.lod ?? 1,
    },
    {
      id: "phase",
      name: text.metrics.phase,
      unit: "s",
      digits: 2,
      read: () => read().phase,
    },
    {
      id: "blast_time",
      name: text.metrics.blast_time,
      unit: "s",
      digits: 2,
      read: () => Math.max(0, read().stats.blastTime ?? 0),
    },
  ];

  return {
    id: "vfx",
    name: text.module,
    group: "effects",
    items: () => [],
    controls,
    layers,
    metrics,
    attach(host: ModuleHost) {
      const bench = host.bench;
      let own: VfxRenderer | undefined;
      let sink: EffectSink | undefined = host.effects;
      if (!sink) {
        own = createVfxRenderer(host.THREE as ThreeLib, {
          scene: host.scene as THREE_NS.Scene,
          camera: host.camera as THREE_NS.PerspectiveCamera,
        });
        sink = own;
      }
      const effects = sink;
      let effect = "m67";
      let variant = NO_VARIANT;
      let distance = DEFAULT_DISTANCE;
      let auto = false;
      let phase = 0;
      let handle: EffectHandle | null = null;
      let sinceRepeat = 0;

      read = () => {
        const def = explosions[effect];
        const recipe = recipes[effect];
        const budget = def
          ? estimateCost(def)
          : (recipe?.budget.particles ?? 0);
        return { stats: effects.stats?.() ?? {}, phase, budget };
      };

      function replay(): void {
        if (handle !== null) effects.stop(handle);
        phase = 0;
        sinceRepeat = 0;
        handle = effects.play({
          effect,
          point: [BLAST_POINT[0], BLAST_POINT[1], BLAST_POINT[2]],
          direction: [1, 0.2, 0.4],
          normal: [0, 1, 0],
          ...(variant !== NO_VARIANT &&
          recipes[effect]?.params?.options.includes(variant)
            ? { param: variant }
            : {}),
        });
      }

      function choose(id: string): void {
        effect = id;
        const params = recipes[id]?.params;
        variant = params
          ? (params.options[params.default] ?? params.options[0] ?? NO_VARIANT)
          : NO_VARIANT;
        bench?.patch(
          "variant",
          params
            ? {
                hidden: false,
                options: params.options.map((option) => ({
                  id: option,
                  name: option,
                })),
                value: variant,
              }
            : {
                hidden: true,
                options: [{ id: NO_VARIANT, name: text.none }],
                value: NO_VARIANT,
              },
        );
        bench?.sheet?.(sheetFor(id));
        replay();
      }

      function look(): void {
        const eye = eyeFor(distance);
        bench?.look(eye, [0, 1.2, 0]);
      }

      const apply = (change: BenchChange): void => {
        if (change.kind === "layer")
          effects.configure?.({
            [`layer_${change.id.slice(LAYER_ID.length)}`]: change.on,
          });
        else if (change.kind === "action") {
          if (change.id === "replay") replay();
        } else if (change.id === "effect" && typeof change.value === "string")
          choose(change.value);
        else if (change.id === "variant" && typeof change.value === "string") {
          variant = change.value;
          if (recipes[effect]?.params) replay();
        } else if (change.id === "auto_repeat") auto = change.value === true;
        else if (change.id === "distance" && typeof change.value === "number") {
          distance = change.value;
          look();
        } else if (change.id === "lod_band" || change.id === "quality")
          effects.configure?.({ [change.id]: change.value });
      };
      const offChange = bench?.onChange(apply);
      const offFrame = host.onFrame((dt) => {
        phase += dt;
        sinceRepeat += dt;
        own?.update(dt);
        if (
          auto &&
          sinceRepeat >= (options.repeatSeconds ?? DEFAULT_REPEAT_SECONDS)
        )
          replay();
      });
      return () => {
        offChange?.();
        offFrame();
        if (handle !== null) effects.stop(handle);
        bench?.sheet?.(null);
        own?.dispose();
        read = () => ({ stats: {}, phase: 0, budget: 0 });
      };
    },
  };
}
