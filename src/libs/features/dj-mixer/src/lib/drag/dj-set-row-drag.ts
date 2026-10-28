import { SET_ROW_DRAG_TYPE } from '@teensyrom-nx/ui/components/dj';

/**
 * Detects whether a DataTransfer carries a set row drag, by the row type's presence in its types
 * list. This is the only check that works during `dragover`, before a drop.
 */
export function isSetRowDrag(dt: DataTransfer | null): boolean {
  return dt?.types.includes(SET_ROW_DRAG_TYPE) ?? false;
}

/** The id of the row a drop carries: `null` when the drag is not a set row's or the id is empty. */
export function readSetRowDragId(dt: DataTransfer | null): string | null {
  const id = dt?.getData(SET_ROW_DRAG_TYPE);
  return id ? id : null;
}
