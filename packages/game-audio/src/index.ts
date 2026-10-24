/**
 * @adatechnology/game-audio: sound as data. A recipe (layers of noise, oscillators, filters, LFOs and an envelope) is planned into a `SoundPlan`
 * with every number decided by a seeded stream, and the plan is what the WebAudio layer builds. Distance curves, pan, a voice limiter, loops and
 * the two team mixing chains (the game and the art scene) are here; the sounds themselves live in each subject's bank.
 */
export { createRng, drawBetween, streamFor, streamSeed } from './rng'
export { BUILD_ORDERS, BUS_IDS } from './recipe'
export type {
  Automation,
  BuildOrder,
  BusId,
  Curve,
  Envelope,
  EnvelopePoint,
  Falloff,
  FilterBank,
  FilterSpec,
  FormantVoiceSource,
  Layer,
  LayerSource,
  LoopOrder,
  LoopRecipe,
  Modulator,
  NoiseSource,
  OscSource,
  ParamRef,
  Range,
  SoundBank,
  SoundRecipe,
  Time,
} from './recipe'
export { planSound } from './plan'
export type { PlanInput, PlannedAutomation, PlannedEnvelopePoint, PlannedFilter, PlannedLayer, PlannedModulator, PlannedSource, SoundPlan } from './plan'
export { DISTANCE_CURVES, cutoffDivisor, falloffGain, isSilent } from './falloff'
export type { DistanceCurveName } from './falloff'
export { DEFAULT_LISTENER, PAN_LIMIT, PAN_MIN_DISTANCE, listenerDistance, panFor } from './listener'
export type { DistanceMode, Listener } from './listener'
export { BUS_PRIORITY, DEFAULT_MAX_VOICES, VOICE_GROUPS, busPriority, createVoiceManager } from './voices'
export type { VoiceDecision, VoiceGroup, VoiceManager, VoiceManagerOptions, VoiceRefusal, VoiceRequest, VoiceStats } from './voices'
export { LOOP_SMOOTHING, LOOP_START_ABOVE, createLoopState } from './loops'
export type { LoopAction, LoopState } from './loops'
export { DEFAULT_MIX, MIX_PROFILES, busGain, resolveMix } from './mix'
export type { BusSetting, MixProfile } from './mix'
export { createSoundRegistry } from './bank'
export type { DeepPartial, SoundRegistry } from './bank'
export { GAME_SFX_BANK, GAME_SFX_CLASSES, GAME_SFX_FALLBACK, noiseClassRecipe } from './recipes/noise-class'
export type { NoiseClass } from './recipes/noise-class'
export { LIBRARY_BANK, LIBRARY_LOOPS, LIBRARY_SOUNDS } from './library'
export { createAudioEngine } from './webaudio/engine'
export type { AudioChannel, AudioEngine, AudioEngineOptions, AudioStats, PlayOptions, VoiceHandle } from './webaudio/engine'
export type { AudioLoopHandle } from './webaudio/engine-loop'
export { realize } from './webaudio/realize'
export type { RealizedVoice, RealizeTarget } from './webaudio/nodes'
export { buildChain } from './webaudio/chain'
export type { MixChain } from './webaudio/chain'
export { bufferOf, fillImpulse, fillNoise } from './webaudio/noise'
export { globalContext, unlockContext } from './webaudio/context'
export { createAudioSink } from './webaudio/sink'
export type { EngineSink } from './webaudio/sink'
