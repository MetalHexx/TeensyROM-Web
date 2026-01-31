import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { StorageDirectory, StorageType, FileItem, PlayerFilterType } from '../models';

/**
 * Storage service contract defining the interface for storage operations.
 * This interface is implemented by concrete storage services in the infrastructure layer.
 */
export interface IStorageService {
  /**
   * Retrieves directory contents for a specific device and storage type.
   * @param deviceId - The unique identifier of the device
   * @param storageType - The type of storage (USB, SD, etc.)
   * @param path - Optional path within the storage (defaults to root)
   * @returns Observable of StorageDirectory containing directory contents
   */
  getDirectory(
    deviceId: string,
    storageType: StorageType,
    path?: string
  ): Observable<StorageDirectory>;

  /**
   * Index storage on a device.
   * @param deviceId - The unique identifier of the device
   * @param storageType - The type of storage (USB, SD, etc.)
   * @param startingPath - Optional starting path for indexing
   * @returns Observable of index operation result
   */
  index(deviceId: string, storageType: StorageType, startingPath?: string): Observable<unknown>;

  /**
   * Index all storage on all devices.
   * @returns Observable of index all operation result
   */
  indexAll(): Observable<unknown>;

  /**
   * Searches for files across ALL available storage devices (SD and USB) based on search text and filter criteria.
   * 
   * The backend queries all available storages simultaneously and returns combined results
   * ranked by relevance using a weighted scoring algorithm.
   * 
   * @param deviceId - The unique identifier of the device
   * @param searchText - The text to search for in file names
   * @param filterType - Optional filter type to narrow results (games, music, images)
   * @param skip - Number of results to skip for pagination
   * @param take - Number of results to return
   * @returns Observable of matching FileItem array from all storages
   */
  search(
    deviceId: string,
    searchText: string,
    filterType?: PlayerFilterType,
    skip?: number,
    take?: number
  ): Observable<FileItem[]>;

  /**
   * Saves a file to favorites.
   * @param deviceId - The unique identifier of the device
   * @param storageType - The type of storage (USB, SD, etc.)
   * @param filePath - The path to the file to add to favorites
   * @returns Observable of FileItem with updated isFavorite flag
   */
  saveFavorite(deviceId: string, storageType: StorageType, filePath: string): Observable<FileItem>;

  /**
   * Removes a file from favorites.
   * @param deviceId - The unique identifier of the device
   * @param storageType - The type of storage (USB, SD, etc.)
   * @param filePath - The path to the file to remove from favorites
   * @returns Observable that completes when the operation succeeds
   */
  removeFavorite(deviceId: string, storageType: StorageType, filePath: string): Observable<void>;
}

/**
 * Injection token for IStorageService to enable dependency injection by interface.
 * This allows the domain to depend on the interface while the infrastructure
 * provides the concrete implementation.
 */
export const STORAGE_SERVICE = new InjectionToken<IStorageService>('STORAGE_SERVICE');
