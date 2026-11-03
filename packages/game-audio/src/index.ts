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
  SoundSet,
  Time,
} from './recipe'
export { planSound } from './plan'
export {
  DEFAULT_CROSSOVER,
  DEFAULT_SAMPLE_CUTOFF_K,
  DEFAULT_SAMPLE_FALLOFF,
  DEFAULT_SAMPLE_PITCH,
  DEFAULT_TAIL_GAIN,
  LAYER_FLOOR,
  OPEN_CUTOFF,
  SAMPLE_ENVIRONMENTS,
  crossGains,
  farMixAt,
  pickTake,
  planSample,
  sampleCutoff,
  sampleUrls,
  tierFor,
} from './sample'
export type { PlannedSampleLayer, SampleCrossover, SampleEnvironment, SampleLayerRole, SampleMemory, SamplePlan, SamplePlanInput, SampleRef, SampleSound, SampleTail, SampleTier } from './sample'
export { CALIBRATION_ID, CALIBRATION_SOUND, calibrationLoader, encodeWav } from './measure/calibration'
export { CRITERIA, CRITERIA_TARGETS, measureCriteria, recordOutput } from './measure/criteria'
export type { ActionCheck, CriterionId, CriterionResult, MeasureOptions } from './measure/criteria'
export { balanceOf, centroidHz, countHits, dbOf, endDropDb, onsetIndex, peakIndex, peakOf, ringSeconds, rmsDb } from './measure/analyze'
export { SDK_LICENSES, SFX_LAYERS, SFX_TIERS, parseSfxName, sampleBankFromManifest, splitTier } from './manifest'
export type { SampleBankOptions, SampleDefaults, SdkLicense, SfxFileEntry, SfxLayer, SfxManifest, SfxManifestSound } from './manifest'
export { KIT_CATEGORY_BUS, KIT_SAMPLE_ALIASES, kitSampleBank, kitSampleDefaults, loadKitSamples, withAliases } from './kit-samples'
export type { KitSampleBankOptions, LoadKitSamplesOptions } from './kit-samples'
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
export { sceneMany, sceneNoise, sceneRecipe, sceneTone, sceneVoice } from './recipes/scene'
export type { SceneLength, SceneNoise, SceneRecipeOptions, SceneTone, SceneVoice } from './recipes/scene'
export { LIBRARY_BANK, LIBRARY_LOOPS, LIBRARY_SOUNDS } from './library'
export { BODY_FALLOFF, BODY_FOLEY_BANK, BODY_FOLEY_SET_IDS, BODY_FOLEY_TAKES, FOOTSTEP_FALLOFF } from './recipes/body-foley'
export { createSetPicker, retunePlan } from './variation'
export type { SetPicker } from './variation'
export { createAudioEngine, limiterCurve } from './webaudio/engine'
export type { AudioChannel, AudioEngine, AudioEngineOptions, AudioStats, PlayOptions, SampleOptions, VoiceHandle, VoiceStartEvent } from './webaudio/engine'
export { createSampleStore, fetchLoader, inlineLoader } from './webaudio/sample-store'
export type { SampleLoadReport, SampleLoader, SampleStatus, SampleStore } from './webaudio/sample-store'
export { realizeSample, sampleLength } from './webaudio/realize-sample'
export type { RealizedSampleVoice, SampleTarget } from './webaudio/realize-sample'
export type { AudioLoopHandle } from './webaudio/engine-loop'
export type { StartQueueOptions } from './webaudio/engine-queue'
export { realize } from './webaudio/realize'
export type { RealizedVoice, RealizeTarget } from './webaudio/nodes'
export { buildChain } from './webaudio/chain'
export type { MixChain } from './webaudio/chain'
export { bufferOf, fillImpulse, fillNoise } from './webaudio/noise'
export { globalContext, unlockContext } from './webaudio/context'
export { createAudioSink } from './webaudio/sink'
export type { EngineSink } from './webaudio/sink'
/** @deprecated import from '@adatechnology/game-audio/testing' */
export { BENCH_BANK, createAudioTestModule } from './testing'
/** @deprecated import from '@adatechnology/game-audio/testing' */
export type { AudioScenarioLike, AudioTestModule, AudioTestModuleOptions } from './testing'
/** @deprecated import from '@adatechnology/game-audio/testing' */
export { audioBenchTextOf } from './testing'
/** @deprecated import from '@adatechnology/game-audio/testing' */
export type { AudioBenchText } from './testing'
