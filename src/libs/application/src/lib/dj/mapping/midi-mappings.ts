import { Injectable, inject } from '@angular/core';
import { logWarn } from '@teensyrom-nx/utils';
import { MidiSettingsPersistence } from '../midi-settings-persistence';
import type { ControlMappingRecord } from '../ports';
import { MappableControls, type MappableControl } from './mappable-controls';
import { ownerLabel } from './mapping-labels';
import { clampAmount, defaultStyle, isStyleAvailableFor } from './mapping-styles';
import {
  controlKey,
  isControlId,
  sourceKey,
  type ControlIdentity,
  type ControlMapping,
  type MappingStyle,
  type MidiSource,
  type MidiSourceKind,
} from './mapping.models';
import { MidiMappingEngine } from './midi-mapping-engine';
import { MidiMappingStore } from './midi-mapping-store';

/** What a binding change did: the mapping now in force, and the control the source was taken
 *  from when it already drove another. */
export interface BindResult {
  readonly mapping: ControlMapping;
  readonly movedFrom: ControlIdentity | null;
}

/**
 * The mapping commands: loads the saved mappings into `MidiMappingStore`, and adds, moves,
 * restyles and removes them, saving after each change. One source drives one control, so binding
 * a source that already drives another control moves it; a control keeps any number of sources.
 * A mapping's hold is let go before the mapping is removed or moved.
 */
@Injectable({ providedIn: 'root' })
export class MidiMappings {
  private readonly store = inject(MidiMappingStore);
  private readonly persistence = inject(MidiSettingsPersistence);
  private readonly controls = inject(MappableControls);
  private readonly engine = inject(MidiMappingEngine);

  /** Loads the saved controllers and mappings into the store, once. A mapping whose control is not
   *  on the list, or whose source another mapping already uses, is dropped with a warning. */
  async hydrate(): Promise<void> {
    const settings = await this.persistence.load();
    if (this.store.loaded()) {
      return;
    }

    const used = new Set<string>();
    const mappings: ControlMapping[] = [];
    for (const record of settings.mappings) {
      const mapping = this.toMapping(record);
      if (mapping === null) {
        logWarn(
          `MidiMappings: dropped mapping ${record.id} — unknown control ${record.owner}:${record.control}.`
        );
        continue;
      }
      const key = sourceKey(mapping.source);
      if (used.has(key)) {
        logWarn(
          `MidiMappings: dropped mapping ${record.id} — its source already drives another control.`
        );
        continue;
      }
      used.add(key);
      mappings.push(mapping);
    }

    this.store.setMidiMappingData({ controllers: settings.controllers, mappings });
  }

  /** Maps a source onto a control. Unchanged when the source already drives that control; when it
   *  drives another, that mapping is removed first. A style the source and control cannot take is
   *  replaced by their default. */
  bind(source: MidiSource, control: ControlIdentity, style: MappingStyle): BindResult {
    const mappable = this.controls.find(control);
    if (mappable === null) {
      throw new Error(`MidiMappings: ${controlKey(control)} is not a mappable control.`);
    }

    const existing = this.store.mappingBySource(sourceKey(source))();
    if (existing !== null && controlKey(existing.control) === controlKey(control)) {
      return { mapping: existing, movedFrom: null };
    }

    const movedFrom = this.take(existing);
    const mapping: ControlMapping = {
      id: crypto.randomUUID(),
      source,
      control,
      style: this.usableStyle(mappable, source.kind, style),
    };
    this.store.upsertMapping({ mapping });
    this.persistence.scheduleSave();
    return { mapping, movedFrom };
  }

  /** Removes a mapping and announces it. */
  remove(id: string): void {
    const mapping = this.find(id);
    if (mapping === null) {
      return;
    }
    const name = this.controls.find(mapping.control)?.name ?? mapping.control.control;
    this.engine.releaseMapping(id);
    this.store.removeMapping({ id });
    this.store.announce({ text: `Binding deleted: ${name}, ${ownerLabel(mapping.control.owner)}` });
    this.persistence.scheduleSave();
  }

  /** Changes a mapping's style. Refused when the control cannot take that style from the mapping's
   *  source; the amount is kept inside what the style accepts. */
  setStyle(id: string, style: MappingStyle): void {
    const mapping = this.find(id);
    const control = mapping === null ? null : this.controls.find(mapping.control);
    if (mapping === null || control === null) {
      return;
    }
    if (!isStyleAvailableFor(control, mapping.source.kind, style.kind)) {
      logWarn(`MidiMappings: style ${style.kind} refused for ${controlKey(mapping.control)}.`);
      return;
    }

    this.store.upsertMapping({
      mapping: {
        ...mapping,
        style: { kind: style.kind, amount: clampAmount(control, style.kind, style.amount) },
      },
    });
    this.persistence.scheduleSave();
  }

  /** Re-learns a mapping onto another source, with the same move rule as `bind`. The current
   *  style is kept when the new source's kind still offers it, otherwise `proposed` is used.
   *  Returns `null` for an unknown mapping. */
  replaceSource(id: string, source: MidiSource, proposed: MappingStyle): BindResult | null {
    const current = this.find(id);
    const control = current === null ? null : this.controls.find(current.control);
    if (current === null || control === null) {
      return null;
    }
    if (sourceKey(source) === sourceKey(current.source)) {
      return { mapping: current, movedFrom: null };
    }

    const occupant = this.store.mappingBySource(sourceKey(source))();
    const movedFrom = occupant !== null && occupant.id !== id ? this.take(occupant) : null;

    this.engine.releaseMapping(id);
    const style = isStyleAvailableFor(control, source.kind, current.style.kind)
      ? current.style
      : this.usableStyle(control, source.kind, proposed);
    const mapping: ControlMapping = { ...current, source, style };
    this.store.upsertMapping({ mapping });
    this.persistence.scheduleSave();
    return { mapping, movedFrom };
  }

  private find(id: string): ControlMapping | null {
    return this.store.mappings().find((mapping) => mapping.id === id) ?? null;
  }

  /** Releases and removes the mapping that held a source; returns the control it drove. */
  private take(mapping: ControlMapping | null): ControlIdentity | null {
    if (mapping === null) {
      return null;
    }
    this.engine.releaseMapping(mapping.id);
    this.store.removeMapping({ id: mapping.id });
    return mapping.control;
  }

  private usableStyle(
    control: MappableControl,
    sourceKind: MidiSourceKind,
    style: MappingStyle
  ): MappingStyle {
    if (!isStyleAvailableFor(control, sourceKind, style.kind)) {
      logWarn(
        `MidiMappings: style ${style.kind} is not available for ${controlKey(
          control.identity
        )}; using the default.`
      );
      return defaultStyle(control, sourceKind);
    }
    return { kind: style.kind, amount: clampAmount(control, style.kind, style.amount) };
  }

  private toMapping(record: ControlMappingRecord): ControlMapping | null {
    if (!isControlId(record.control)) {
      return null;
    }
    const control: ControlIdentity = { owner: record.owner, control: record.control };
    return this.controls.find(control) === null
      ? null
      : { id: record.id, source: record.source, control, style: record.style };
  }
}
