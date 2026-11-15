# Issue para o Jolt: inércia pequena

Aberta em 2026-11-13 com o ok do dono: https://github.com/jrouwe/JoltPhysics/issues/2220

Texto enviado, verbatim de `specs/008-motor-fisico-jolt/spec.md` §5.1:

```text
Title: Bodies with very small principal inertia get a 1 m sphere's inertia (0.4 * mass) instead of their own

Version: jolt-physics 1.1.1 (npm, wasm-compat), also reproducible from C++ per our reading.

A dynamic body whose principal moments of inertia are below roughly 1e-6 kg m^2 ends up with the inertia of a
solid sphere of radius 1 m (I = 0.4 * m) on every axis, instead of the inertia computed from its shape. For small
bodies (a 9 mm casing, a 1.5 cm chip) this is ~10 000x too large: they never stop rolling and never sleep.

Repro (pure Jolt, no wrapper):
  shape: CylinderShapeSettings(halfHeight 0.0095, radius 0.005, convexRadius 0.001)
  BodyCreationSettings: EMotionType_Dynamic,
    mOverrideMassProperties = EOverrideMassProperties_CalculateInertia,
    mMassPropertiesOverride.mMass = 0.004
  body.GetMotionProperties().GetInverseInertiaDiagonal()
Expected: about (6.9e6, 2.0e7, 6.9e6)   (I ~ 1.45e-7, 5.0e-8, 1.45e-7 kg m^2)
Actual:   (625, 625, 625)                (I = 0.4 * 0.004 = 1.6e-3 kg m^2)

The fallback looks like it triggers on an absolute threshold. A threshold relative to mass and size (or none,
as long as the moments are positive) would keep small bodies correct.

Workaround we use: create the body with mass and inertia scaled by 1e6, then write the true values back with
MotionProperties::SetInverseInertia / SetInverseMass right after creation.
```
