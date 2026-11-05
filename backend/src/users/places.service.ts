import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { MAX_SAVED_PLACES, type SavedPlace, type SavedPlaceKind } from '@apniride/shared';
import type pg from 'pg';
import { AppException } from '../common/app-exception.js';
import { PG_POOL } from '../database/database.module.js';

interface PlaceRow {
  id: string;
  kind: SavedPlaceKind;
  label: string;
  lat: number;
  lng: number;
}

const COLUMNS = `id, kind, label, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng`;
const toPlace = (r: PlaceRow): SavedPlace => ({
  id: r.id,
  kind: r.kind,
  label: r.label,
  location: { latitude: r.lat, longitude: r.lng },
});
const notFound = () => new AppException(HttpStatus.NOT_FOUND, 'not_found', 'Place not found');

export interface PlaceInput {
  kind: SavedPlaceKind;
  label: string;
  location: { latitude: number; longitude: number };
}

/** Home, Work and other favourite places, for faster booking. Private to the user. */
@Injectable()
export class PlacesService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async list(userId: string): Promise<SavedPlace[]> {
    // Home first, then Work, then the rest in the order they were added.
    const { rows } = await this.pool.query<PlaceRow>(
      `SELECT ${COLUMNS} FROM saved_places WHERE user_id = $1
        ORDER BY CASE kind WHEN 'home' THEN 0 WHEN 'work' THEN 1 ELSE 2 END, created_at`,
      [userId],
    );
    return rows.map(toPlace);
  }

  /** Saving Home or Work again replaces the old one (there is only one of each). */
  async create(userId: string, input: PlaceInput): Promise<SavedPlace> {
    const point = `ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography`;
    if (input.kind !== 'other') {
      const { rows } = await this.pool.query<PlaceRow>(
        `INSERT INTO saved_places (user_id, kind, label, location) VALUES ($1, $2, $3, ${point})
         ON CONFLICT (user_id, kind) WHERE kind IN ('home', 'work')
         DO UPDATE SET label = EXCLUDED.label, location = EXCLUDED.location, updated_at = now()
         RETURNING ${COLUMNS}`,
        [userId, input.kind, input.label, input.location.latitude, input.location.longitude],
      );
      return toPlace(rows[0]!);
    }
    // The count check and insert in one statement, so two quick taps can't go over the limit.
    const { rows } = await this.pool.query<PlaceRow>(
      `INSERT INTO saved_places (user_id, kind, label, location)
       SELECT $1, $2, $3, ${point}
        WHERE (SELECT count(*) FROM saved_places WHERE user_id = $1) < $6
       RETURNING ${COLUMNS}`,
      [userId, input.kind, input.label, input.location.latitude, input.location.longitude, MAX_SAVED_PLACES],
    );
    if (!rows[0]) {
      throw new AppException(HttpStatus.CONFLICT, 'too_many_places', `At most ${MAX_SAVED_PLACES} saved places`);
    }
    return toPlace(rows[0]);
  }

  async update(userId: string, id: string, input: PlaceInput): Promise<SavedPlace> {
    try {
      const { rows } = await this.pool.query<PlaceRow>(
        `UPDATE saved_places
            SET kind = $3, label = $4, location = ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography, updated_at = now()
          WHERE id = $1 AND user_id = $2
         RETURNING ${COLUMNS}`,
        [id, userId, input.kind, input.label, input.location.latitude, input.location.longitude],
      );
      if (!rows[0]) throw notFound();
      return toPlace(rows[0]);
    } catch (err) {
      // Turning an "other" place into a second Home / Work.
      if ((err as { code?: string }).code === '23505') {
        throw new AppException(HttpStatus.CONFLICT, 'place_exists', `You already have a ${input.kind} place`);
      }
      throw err;
    }
  }

  /** Deleting a place that's already gone is fine (retry after a lost response). */
  async remove(userId: string, id: string): Promise<void> {
    await this.pool.query('DELETE FROM saved_places WHERE id = $1 AND user_id = $2', [id, userId]);
  }
}
