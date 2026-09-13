import {
  DJ_FILE_DRAG_TYPE,
  DjFileDragPayload,
  setDjFileDragData,
  readDjFileDragData,
  isDjFileDrag,
} from './dj-file-drag';
import { StorageType } from '@teensyrom-nx/domain';

describe('dj-file-drag', () => {
  let mockDataTransfer: Partial<DataTransfer>;

  beforeEach(() => {
    mockDataTransfer = {
      data: {} as Record<string, string>,
      types: [] as string[],
      setData: (type: string, value: string) => {
        (mockDataTransfer.data as Record<string, string>)[type] = value;
        (mockDataTransfer.types as string[]).push(type);
      },
      getData: (type: string) => {
        return (mockDataTransfer.data as Record<string, string>)[type] ?? '';
      },
      effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
    };
  });

  describe('setDjFileDragData', () => {
    it('should set the drag data with correct MIME type', () => {
      const payload: DjFileDragPayload = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'song.sid',
      };

      setDjFileDragData(mockDataTransfer as DataTransfer, payload);

      expect((mockDataTransfer.data as Record<string, string>)[DJ_FILE_DRAG_TYPE]).toBe(
        JSON.stringify(payload)
      );
    });

    it('should set effectAllowed to copy', () => {
      const payload: DjFileDragPayload = {
        deviceId: 'dev1',
        storageType: StorageType.Usb,
        path: '/files',
        fileName: 'tune.sid',
      };

      setDjFileDragData(mockDataTransfer as DataTransfer, payload);

      expect(mockDataTransfer.effectAllowed).toBe('copy');
    });
  });

  describe('readDjFileDragData', () => {
    it('should read and parse valid drag data', () => {
      const payload: DjFileDragPayload = {
        deviceId: 'dev1',
        storageType: StorageType.Sd,
        path: '/music',
        fileName: 'song.sid',
      };

      setDjFileDragData(mockDataTransfer as DataTransfer, payload);

      const result = readDjFileDragData(mockDataTransfer as DataTransfer);

      expect(result).toEqual(payload);
    });

    it('should return null for null DataTransfer', () => {
      const result = readDjFileDragData(null);

      expect(result).toBeNull();
    });

    it('should return null when data is missing', () => {
      const result = readDjFileDragData(mockDataTransfer as DataTransfer);

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', () => {
      (mockDataTransfer.data as Record<string, string>)[DJ_FILE_DRAG_TYPE] = 'not-json';
      (mockDataTransfer.types as string[]).push(DJ_FILE_DRAG_TYPE);

      const result = readDjFileDragData(mockDataTransfer as DataTransfer);

      expect(result).toBeNull();
    });
  });

  describe('isDjFileDrag', () => {
    it('should return true when DJ_FILE_DRAG_TYPE is in types', () => {
      (mockDataTransfer.types as string[]).push(DJ_FILE_DRAG_TYPE);

      const result = isDjFileDrag(mockDataTransfer as DataTransfer);

      expect(result).toBe(true);
    });

    it('should return false when DJ_FILE_DRAG_TYPE is not in types', () => {
      const result = isDjFileDrag(mockDataTransfer as DataTransfer);

      expect(result).toBe(false);
    });

    it('should return false for null DataTransfer', () => {
      const result = isDjFileDrag(null);

      expect(result).toBe(false);
    });

    it('should work with only types array populated', () => {
      (mockDataTransfer.types as string[]).push(DJ_FILE_DRAG_TYPE);
      // Clear data to ensure we're checking types only
      (mockDataTransfer.data as Record<string, string>) = {};

      const result = isDjFileDrag(mockDataTransfer as DataTransfer);

      expect(result).toBe(true);
    });
  });
});
