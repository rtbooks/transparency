/**
 * Temporal Repository Pattern
 * 
 * Generic repository for performing CRUD operations on temporal entities
 */

import { PrismaClient } from '@/generated/prisma/client';
import {
  MAX_DATE,
  TemporalFields,
  buildCurrentVersionWhere,
  buildAsOfDateWhere,
  isCurrentVersion,
} from './temporal-utils';

export class TemporalRepository<T extends TemporalFields> {
  constructor(
    private prisma: PrismaClient,
    private modelName: string
  ) {}

  private get model(): any {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Find current version by ID
   */
  async findCurrentById(id: string): Promise<(T & TemporalFields) | null> {
    return this.model.findFirst({
      where: buildCurrentVersionWhere({ id }),
    });
  }

  /**
   * Find all current versions matching criteria
   */
  async findAllCurrent(where: Record<string, any> = {}): Promise<T[]> {
    return this.model.findMany({
      where: buildCurrentVersionWhere(where),
    });
  }

  /**
   * Find version as of a specific date
   */
  async findAsOf(id: string, asOfDate: Date): Promise<T | null> {
    return this.model.findFirst({
      where: buildAsOfDateWhere(asOfDate, { id }),
    });
  }

  /**
   * Get all versions of a record
   */
  async findHistory(id: string): Promise<T[]> {
    return this.model.findMany({
      where: { id },
      orderBy: { validFrom: 'desc' },
    });
  }

  /**
   * Create a new entity (initial version)
   */
  async create(data: Partial<T>, userId?: string): Promise<T> {
    const now = new Date();
    
    return this.model.create({
      data: {
        ...data,
        versionId: crypto.randomUUID(),
        previousVersionId: null,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        changedBy: userId || null,
      },
    });
  }

  /**
   * Update an entity (create new version, close old)
   */
  async update(id: string, updates: Partial<T>, userId?: string): Promise<T> {
    const now = new Date();
    
    // Get current version
    const current = await this.findCurrentById(id);
    if (!current) {
      throw new Error(`No current version found for ${this.modelName} with id ${id}`);
    }

    // Close current version
    await this.model.update({
      where: { versionId: current.versionId },
      data: {
        validTo: now,
        systemTo: now,
      },
    });

    // Create new version
    return this.model.create({
      data: {
        ...current,
        ...updates,
        id: current.id, // Keep same logical ID
        versionId: crypto.randomUUID(),
        previousVersionId: current.versionId,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        changedBy: userId || null,
      },
    });
  }

  /**
   * Soft delete an entity
   */
  async softDelete(id: string, userId?: string): Promise<T> {
    const now = new Date();
    
    // Get current version
    const current = await this.findCurrentById(id);
    if (!current) {
      throw new Error(`No current version found for ${this.modelName} with id ${id}`);
    }

    // Update to mark as deleted
    return this.model.update({
      where: { versionId: current.versionId },
      data: {
        validTo: now,
        systemTo: now,
        isDeleted: true,
        deletedAt: now,
        deletedBy: userId || null,
      },
    });
  }

  /**
   * Restore a soft-deleted entity
   */
  async restore(id: string, userId?: string): Promise<T> {
    const now = new Date();
    
    // Find the deleted version
    const deleted = await this.model.findFirst({
      where: {
        id,
        isDeleted: true,
        validTo: { lte: now },
      },
      orderBy: { validTo: 'desc' },
    });

    if (!deleted) {
      throw new Error(`No deleted version found for ${this.modelName} with id ${id}`);
    }

    // Create new version (restored)
    return this.model.create({
      data: {
        ...deleted,
        versionId: crypto.randomUUID(),
        previousVersionId: deleted.versionId,
        validFrom: now,
        validTo: MAX_DATE,
        systemFrom: now,
        systemTo: MAX_DATE,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        changedBy: userId || null,
      },
    });
  }
}
