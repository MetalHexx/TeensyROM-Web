# DJ Controls - Product Requirements Document

## Executive Summary 🎯

The DJ Controls system provides professional-grade music manipulation capabilities for live performance and creative sound design. These controls enable precise tempo matching, real-time speed adjustments, and expressive voice manipulation specifically optimized for SID file playback on TeensyROM devices.

This feature set transforms the TeensyROM Player from a simple media player into a powerful DJ tool capable of beat matching between multiple devices, live mixing, and creative audio effects.

## Product Overview 📋

### Core Capabilities

- **Speed Control**: Precise tempo adjustment with coarse and fine granularity
- **Beat Matching**: Nudge controls for synchronizing tracks across multiple devices
- **Creative Effects**: Speed jumps and fast-forward steps for dramatic sonic manipulation
- **Voice Manipulation**: Individual SID voice control for live remixing
- **Seeking Navigation**: SID-optimized forward and backward seeking
- **Live Performance Controls**: Hold function and instant restart for DJ techniques

### Target Use Cases

- **Live DJ Performance**: Beat matching and mixing between multiple TeensyROM devices
- **Creative Sound Design**: Experimental tempo manipulation and voice isolation
- **Remix Sessions**: Combining voice toggles with speed effects for unique arrangements
- **Practice Sessions**: Learning and rehearsing timing techniques with precise controls

---

## Core Concepts & Terminology 📚

### Base Speed

The user-defined speed setting that persists across all operations. This is the "home" speed that all temporary modifications calculate from. When temporary effects are released, playback returns to this speed.

- **Default Value**: 0% (original playback speed)
- **Persistence**: Maintained until explicitly changed by the user
- **Foundation**: All [Altered Speed](#altered-speed) calculations derive from this value

### Altered Speed

Any temporary speed modification calculated from the [Base Speed](#base-speed). These modifications are active only while their controls are engaged and automatically release back to Base Speed.

Examples of Altered Speed:

- [Nudge](#nudging-system) adjustments (±5%)
- [Speed Jump](#speed-jump-system) effects (±50%)
- [Fast Forward](#fast-forward-system) steps (+50% to +1000%)

### Speed Delta

The percentage change from original playback speed. Expressed as a positive or negative percentage value.

- **Positive Delta**: Faster than original (e.g., +10% = 1.1x speed)
- **Negative Delta**: Slower than original (e.g., -10% = 0.9x speed)
- **Zero Delta**: Original playback speed

### SID Voice

SID sound files contain three independent synthesizer voice channels. Each voice can be individually controlled, enabling creative mixing and isolation effects.

- **Voice 1**: First synthesizer channel
- **Voice 2**: Second synthesizer channel
- **Voice 3**: Third synthesizer channel

---

## User Personas & Scenarios 👥

### The Live DJ 🎧

**Scenario**: Performing a live set with two TeensyROM devices, mixing between SID tracks

**Needs**: Precise beat matching, seamless transitions, real-time tempo adjustment

**Workflow**: Load tracks on both devices → Match tempos using nudge controls → Fine-tune with coarse/fine speed → Transition using hold function → Apply speed jumps for dramatic moments

### The Remix Artist 🎹

**Scenario**: Creating live remixes by manipulating individual voice channels

**Needs**: Voice isolation, creative effects, tempo experimentation

**Workflow**: Start playback → Toggle voices to isolate elements → Apply speed effects → Use kill switches for rhythmic muting → Layer effects for unique sound design

### The Speed Controller 🎚️

**Scenario**: Practicing tempo control and beat matching techniques

**Needs**: Understanding of speed relationships, precise control feedback, practice tools

**Workflow**: Set base speed → Practice nudging technique → Experiment with speed jumps → Learn timing using hold function → Build muscle memory for live performance

---

## Speed Control System ⏯️

### Set Song Speed - Coarse Control

Primary speed adjustment mechanism for tempo matching and general speed changes.

#### Adjustment Behavior

- **Increment Size**: One-tenth percent (0.1%) per adjustment step
- **Direction**: Both increase and decrease available
- **Persistence**: Becomes the new [Base Speed](#base-speed) after adjustment

#### Curve Options

Two speed curve modes for different adjustment feel:

- **Linear Curve**: Equal increment at all speed levels
- **Logarithmic Curve**: Larger increments at higher speeds, smaller at lower speeds

#### System Effects

- **Timer Synchronization**: Progress timer adjusts proportionally with speed changes
- **Altered Speed Recalculation**: Any active [Altered Speed](#altered-speed) effects recalculate based on new base
- **Immediate Application**: Speed change takes effect instantly

### Set Song Speed - Fine Control

Precision speed adjustment for detailed tempo matching.

#### Adjustment Behavior

- **Increment Size**: One-hundredth percent (0.01%) per adjustment step
- **Direction**: Both increase and decrease available
- **Persistence**: Becomes the new [Base Speed](#base-speed) after adjustment

#### Use Cases

- **Beat Matching Finesse**: Final alignment when tracks are nearly synchronized
- **Micro-Adjustments**: Subtle speed corrections during playback
- **Precision Work**: When coarse control is too aggressive

### Home Speed Function

Single-action speed normalization control.

#### Behavior

- **Action**: Returns [Base Speed](#base-speed) to 0% (original playback speed)
- **Timer Reset**: Progress timing returns to original rate
- **Altered Speed Impact**: Any active temporary modifications recalculate to new 0% base

#### Use Cases

- **Quick Reset**: Instantly return to original tempo
- **Recovery**: Escape from extreme speed settings
- **Starting Point**: Reset before beginning new tempo work

---

## Seeking System 🔍

### SID File Constraints

SID files have unique playback characteristics that affect seeking behavior.

#### Technical Limitations

- **No Random Access**: Files cannot jump directly to arbitrary time positions
- **Sequential Playback**: Audio must be generated in order from file start

#### Seeking Implementation

- **Forward Seek**: Fast-forward at accelerated speed to target position
- **Backward Seek**: Restart file from beginning, then fast-forward to target position

### Seek Speed Modes

Two seeking speed options for different use cases.

#### Accurate Mode

- **Speed**: +1000% playback speed during seek
- **Timer Behavior**: Progress timer maintains synchronization
- **Accuracy**: Precise positioning at target location
- **Recommended Use**: Most seeking operations

#### Insane Mode

- **Speed**: +10,000% playback speed during seek
- **Timer Behavior**: May lose synchronization due to extreme speed
- **Accuracy**: Limited precision at target location
- **Creative Use**: Can produce unique DJ effects as side benefit

### Seek Behavior Rules

#### During Seek Operation

- **Timer Display**: Shows accelerated progress during seek
- **Visual Feedback**: Indicates seeking is in progress

#### Seek Completion

- **Speed Restoration**: Returns to [Base Speed](#base-speed) upon reaching target position
- **Timer Sync**: Progress timer reflects new position

#### Seek Cancellation

- **Any Control Cancels**: Activating any playback control ends seek operation
- **Speed Restoration**: Immediately returns to [Base Speed](#base-speed)
- **Position Retention**: Stops at current position, does not complete seek to target

---

## Nudging System 🎛️

Professional beat matching controls for synchronizing tracks across devices.

### Nudge Controls

Two independent controls for tempo micro-adjustments.

#### Positive Nudge

- **Effect**: +5% temporary speed increase
- **Control Type**: Momentary (active while pressed)
- **Release**: Returns to [Base Speed](#base-speed)

#### Negative Nudge

- **Effect**: -5% temporary speed decrease
- **Control Type**: Momentary (active while pressed)
- **Release**: Returns to [Base Speed](#base-speed)

### Speed Calculation

Nudge effects always calculate from current [Base Speed](#base-speed).

#### Calculation Example

| Base Speed | Nudge Direction | Resulting Speed |
| ---------- | --------------- | --------------- |
| 0%         | +5%             | +5%             |
| +10%       | +5%             | +15%            |
| -5%        | +5%             | 0%              |
| +10%       | -5%             | +5%             |

### Interactive Behavior

#### Base Speed Changes During Nudge

- **Dynamic Recalculation**: If user adjusts [Base Speed](#base-speed) while nudge is active, the [Altered Speed](#altered-speed) recalculates immediately
- **Example**: Nudging at +5% on 0% base (=5% total), user adjusts base to +10%, nudge now produces +15% total

#### Release Target

- **Always Returns to Base**: When nudge is released, speed returns to current [Base Speed](#base-speed)
- **Not Original Speed**: Returns to base even if base changed during nudge

### Professional Use Cases

- **Beat Matching**: Nudge forward or backward to align beats between two tracks
- **Drift Correction**: Minor adjustments to keep tracks synchronized during long mixes
- **Phrase Alignment**: Sync track sections for seamless transitions

---

## Speed Jump System ⚡

Dramatic temporary speed changes for creative effects and transitions.

### Jump Controls

Two controls for major tempo shifts.

#### Positive Jump

- **Effect**: +50% temporary speed increase
- **Control Type**: Momentary (active while pressed)
- **Release**: Returns to [Base Speed](#base-speed)
- **Creative Use**: Double-time effects, energy builds

#### Negative Jump

- **Effect**: -50% temporary speed decrease
- **Control Type**: Momentary (active while pressed)
- **Release**: Returns to [Base Speed](#base-speed)
- **Creative Use**: Half-time effects, breakdowns, dramatic moments

### Integration with Nudging

Speed jumps and nudges can combine for extended range.

#### Cumulative Effects

When both [Speed Jump](#speed-jump-system) and [Nudging](#nudging-system) are active simultaneously:

| Jump Effect | Nudge Effect | Combined Alteration |
| ----------- | ------------ | ------------------- |
| +50%        | +5%          | +55%                |
| +50%        | -5%          | +45%                |
| -50%        | +5%          | -45%                |
| -50%        | -5%          | -55%                |

#### Independent Release

Each system releases independently:

- **Jump Released First**: Speed returns to base + active nudge
- **Nudge Released First**: Speed returns to base + active jump
- **Both Released**: Speed returns to [Base Speed](#base-speed)

---

## Fast Forward System ⏩

Multi-step speed progression for dramatic tempo effects.

### Speed Steps

Progressive acceleration through five distinct stages:

| Step | Name        | Speed Increase | Description              |
| ---- | ----------- | -------------- | ------------------------ |
| 1    | Fast        | +50%           | Moderate acceleration    |
| 2    | Faster      | +100%          | Double speed             |
| 3    | Even Faster | +200%          | Triple speed             |
| 4    | Fastest     | +1000%         | Maximum acceleration     |
| 5    | Reset       | 0%             | Return to Base Speed     |

### Step Behavior

#### Sequential Activation

- **Each Press Advances**: Control press moves to next step in sequence
- **Cycle Completion**: After "Fastest" step, next press returns to [Base Speed](#base-speed)
- **No Skip**: Must progress through steps in order

#### Base Speed Integration

- **All Calculations from Base**: Each step calculates from current [Base Speed](#base-speed)
- **Example**: At +10% base speed, "Fast" step produces +60% total (+10% + 50%)

### Creative Applications

- **Build-Up Effects**: Progressive acceleration for dramatic tension
- **Transition Tool**: Speed through sections to reach specific points
- **Performance Element**: Visual and audio effect for live shows

---

## Hold Function ⏸️

DJ-style momentary pause control optimized for live performance.

### Control Behavior

#### Press and Hold Mechanics

- **Mouse Down**: Immediately pauses playback
- **Mouse Up**: Immediately resumes playback
- **Latency**: Zero-delay response for precise timing

### Distinction from Standard Pause

| Aspect         | Hold Function        | Standard Pause    |
| -------------- | -------------------- | ----------------- |
| Activation     | Mouse down           | Click (down+up)   |
| Deactivation   | Mouse up             | Second click      |
| Use Case       | Momentary pause      | Extended pause    |
| Control Type   | Momentary            | Toggle            |

### DJ Utility

- **Record Simulation**: Mimics vinyl record hold-and-release technique
- **Timing Control**: Precise control over when playback resumes
- **Beat Drops**: Hold before downbeat, release for impact
- **Stuttering**: Rapid press/release for stutter effects

---

## Restart Song Function 🔄

Instant song reset control for performance and practice.

### Behavior

#### Immediate Restart

- **Action**: Always restarts song from the beginning
- **Trigger**: Activates immediately on mouse down
- **No Conditions**: Unlike Previous button, has no time-based logic

### Comparison to Previous Button

| Aspect           | Restart Function       | Previous Button       |
| ---------------- | ---------------------- | --------------------- |
| Behavior         | Always restart current | Context-dependent     |
| Time Rule        | None                   | 5-second threshold    |
| Under 5 seconds  | Restart current        | Go to previous song   |
| Over 5 seconds   | Restart current        | Restart current       |
| Purpose          | Dedicated restart      | Navigation + restart  |

### Use Cases

- **Practice Loops**: Restart section to practice timing
- **Performance Reset**: Quick recovery from mistakes
- **Cue Point Return**: Return to song beginning for mixing

---

## SID Voice Management 🎼

Individual voice channel control for creative mixing and isolation.

### Voice System Overview

SID files contain three independent synthesizer voice channels that can be controlled individually for mixing effects.

### Toggle Voice System

Persistent voice enable/disable controls.

#### Voice Controls

- **Individual Toggles**: Separate toggle for Voice 1, Voice 2, and Voice 3
- **Toggle Behavior**: Combined mouse down/up action switches state
- **State Persistence**: Setting maintained throughout playback session
- **Combination Freedom**: Any combination of active/inactive voices is valid

#### Use Cases

- **Voice Isolation**: Disable two voices to hear one in isolation
- **Layer Building**: Enable voices progressively for arrangement effects
- **Analysis**: Study individual parts of SID compositions

### Kill/Activate Voice System

Temporary voice control for live performance.

#### Default Kill Switch Behavior

When voice is currently enabled (by [Toggle Voice](#toggle-voice-system)):

- **Mouse Down**: Temporarily disables voice
- **Mouse Up**: Re-enables voice
- **Control Type**: Momentary (active while pressed)

#### Smart State Integration

Intelligent behavior adaptation based on current toggle state:

##### When Voice Disabled by Toggle

Kill switch inverts to become "Activate Voice":

- **Mouse Down**: Temporarily enables the disabled voice
- **Mouse Up**: Returns voice to disabled state
- **Effect**: Allows momentary voice activation

##### When Voice Enabled by Toggle

Kill switch functions normally:

- **Mouse Down**: Temporarily disables the enabled voice
- **Mouse Up**: Returns voice to enabled state
- **Effect**: Standard momentary muting

#### Utility Benefits

| Base State | Control Press | Control Release | Behavior Name     |
| ---------- | ------------- | --------------- | ----------------- |
| Enabled    | Mutes voice   | Unmutes voice   | Kill Switch       |
| Disabled   | Unmutes voice | Mutes voice     | Activate Switch   |

- **Intuitive Operation**: Same control always provides momentary change from current state
- **No State Conflicts**: Never overrides or contradicts toggle settings
- **Live Performance**: Quick voice effects regardless of toggle configuration

---

## Business Rules & Constraints ⚖️

### Speed Control Hierarchy

- [Base Speed](#base-speed) provides the foundation for all speed calculations
- All [Altered Speed](#altered-speed) modifications calculate from current Base Speed
- Multiple temporary modifications (nudge + jump) combine additively
- All temporary modifications return to Base Speed when released
- Base Speed changes cause immediate recalculation of active alterations

### Timer Synchronization

- Progress timers adjust proportionally with all speed changes
- Seeking operations show accelerated timer progress
- Timer accuracy may degrade in [Insane Mode](#insane-mode) seeking
- Timer returns to normal rate when speed returns to base

### Control Independence

- Each control system operates independently
- Multiple systems can be active simultaneously
- Release order does not affect final state (always returns to Base Speed)
- No control permanently modifies another control's base state

### SID-Specific Constraints

- Seeking always requires playback (cannot seek while paused)
- Voice controls only affect SID files
- Backward seeking requires file restart then forward seek

---

## User Interface Requirements 🖥️

### Control Types

#### Toggle Controls

- **Behavior**: State switches on combined mouse down/up action
- **Applications**: [Toggle Voice](#toggle-voice-system), speed curve selection
- **Visual Feedback**: Clear indication of current on/off state

#### Momentary Controls

- **Behavior**: Active during mouse press only, releases on mouse up
- **Applications**: [Hold Function](#hold-function), [Kill/Activate Voice](#killactivate-voice-system), [Nudging](#nudging-system), [Speed Jump](#speed-jump-system)
- **Visual Feedback**: Immediate response indication while pressed

#### Immediate Action Controls

- **Behavior**: Triggers action on mouse down (no wait for mouse up)
- **Applications**: [Restart Song](#restart-song-function)
- **Visual Feedback**: Instant visual confirmation of action

#### Stepped Controls

- **Behavior**: Each activation advances to next step in sequence
- **Applications**: [Fast Forward System](#fast-forward-system)
- **Visual Feedback**: Current step indication

### Speed Display

- **Current Base Speed**: Always visible, shows persistent speed setting
- **Active Alterations**: Indicate when nudge, jump, or fast-forward active
- **Total Effective Speed**: Show combined result of base + alterations
- **Seek Status**: Indicate when seeking is in progress

### Voice Indicators

- **Toggle State**: Clear indication of each voice's toggle setting (on/off)
- **Momentary State**: Visual feedback when kill/activate is engaged
- **Combined View**: Show both persistent and momentary states simultaneously

---

## Success Criteria ✅

### User Experience Goals

- **Immediate Response**: All controls respond without perceptible delay
- **Intuitive Behavior**: Controls behave as professional DJs expect
- **Clear Feedback**: Users always know current state of all controls
- **Predictable Interactions**: Multiple control combinations behave consistently

### Technical Performance

- **Zero-Latency Controls**: Momentary controls activate/deactivate instantly
- **Accurate Speed Calculation**: All speed mathematics precise and consistent
- **Timer Reliability**: Progress tracking maintains accuracy across speed changes
- **Voice Isolation**: Clean voice enable/disable without audio artifacts

### Business Value

- **Professional DJ Capability**: System meets requirements of live performance
- **Creative Expression**: Tools enable artistic experimentation
- **Learning Support**: Controls help users develop DJ skills
- **Multi-Device Mixing**: Features work reliably across multiple simultaneous devices

---

## Integration Points 🔗

### Player System

The DJ Controls integrate with the broader Player system:

- **Playback State**: Controls only active during music playback
- **Progress Timer**: Speed changes affect timer calculations
- **Current File**: Controls apply to actively playing SID file
- **Device Independence**: Each TeensyROM device has independent DJ control state

### External Hardware

All DJ control operations synchronize with TeensyROM hardware:

- **Speed Commands**: Hardware receives speed change instructions
- **Voice Commands**: Hardware processes voice enable/disable
- **Seek Commands**: Hardware handles seek operations

---

## Future Considerations 🔮

- **MIDI Controller Support**: Map DJ controls to external MIDI hardware
- **Speed Presets**: Save and recall favorite base speed settings
- **Macro Recording**: Record and playback control sequences
- **Cross-Fader Integration**: Smooth transitions between two devices
- **Effect Chains**: Combine multiple effects into single activation

---

_This document describes the complete business requirements for the DJ Controls feature. All controls must integrate with the TeensyROM hardware and maintain per-device independence for multi-device mixing scenarios._
