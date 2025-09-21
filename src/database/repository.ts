import { PoolClient } from 'pg';
import { transaction, query } from './connection';
import { CrawlResult, Fragrance, Brand, CrawlHistory } from '../types';
import { dbLogger as logger } from '../utils/logger';

export class FragranceRepository {

  async saveFragrance(data: CrawlResult): Promise<number | null> {
    try {
      return await transaction(async (client) => {
        const brandId = await this.upsertBrand(client, data.brand);

        const fragranceId = await this.upsertFragrance(client, {
          ...data.fragrance,
          brandId,
        });

        await this.saveNotes(client, fragranceId, data.notes);

        await this.savePerfumers(client, fragranceId, data.perfumers);

        await this.saveAccords(client, fragranceId, data.accords);

        await this.saveSeasons(client, fragranceId, data.seasons);

        await this.saveOccasions(client, fragranceId, data.occasions);

        logger.info(`Saved fragrance: ${data.fragrance.name} (ID: ${fragranceId})`);
        return fragranceId;
      });
    } catch (error) {
      logger.error(`Failed to save fragrance: ${error}`);
      return null;
    }
  }

  private async upsertBrand(client: PoolClient, brand: Brand): Promise<number> {
    const result = await client.query(
      `INSERT INTO brands (name, country, founded_year, description, website)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name)
       DO UPDATE SET
         country = COALESCE(EXCLUDED.country, brands.country),
         founded_year = COALESCE(EXCLUDED.founded_year, brands.founded_year),
         description = COALESCE(EXCLUDED.description, brands.description),
         website = COALESCE(EXCLUDED.website, brands.website),
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [brand.name, brand.country, brand.foundedYear, brand.description, brand.website]
    );
    return result.rows[0].id;
  }

  private async upsertFragrance(client: PoolClient, fragrance: Fragrance): Promise<number> {
    const result = await client.query(
      `INSERT INTO fragrances (
         parfumo_id, name, brand_id, release_year, gender,
         fragrance_type, concentration, description,
         rating_value, rating_count, longevity_rating,
         sillage_rating, bottle_size, url, last_crawled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (parfumo_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         brand_id = EXCLUDED.brand_id,
         release_year = COALESCE(EXCLUDED.release_year, fragrances.release_year),
         gender = COALESCE(EXCLUDED.gender, fragrances.gender),
         fragrance_type = COALESCE(EXCLUDED.fragrance_type, fragrances.fragrance_type),
         concentration = COALESCE(EXCLUDED.concentration, fragrances.concentration),
         description = COALESCE(EXCLUDED.description, fragrances.description),
         rating_value = EXCLUDED.rating_value,
         rating_count = EXCLUDED.rating_count,
         longevity_rating = EXCLUDED.longevity_rating,
         sillage_rating = EXCLUDED.sillage_rating,
         bottle_size = COALESCE(EXCLUDED.bottle_size, fragrances.bottle_size),
         url = EXCLUDED.url,
         last_crawled = EXCLUDED.last_crawled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        fragrance.parfumoId, fragrance.name, fragrance.brandId,
        fragrance.releaseYear, fragrance.gender, fragrance.fragranceType,
        fragrance.concentration, fragrance.description, fragrance.ratingValue,
        fragrance.ratingCount, fragrance.longevityRating, fragrance.sillageRating,
        fragrance.bottleSize, fragrance.url, fragrance.lastCrawled
      ]
    );
    return result.rows[0].id;
  }

  private async saveNotes(
    client: PoolClient,
    fragranceId: number,
    notes: { top: string[]; middle: string[]; base: string[] }
  ): Promise<void> {
    await client.query('DELETE FROM fragrance_notes WHERE fragrance_id = $1', [fragranceId]);

    const positions: Array<{ position: string; notes: string[] }> = [
      { position: 'top', notes: notes.top },
      { position: 'middle', notes: notes.middle },
      { position: 'base', notes: notes.base },
    ];

    for (const { position, notes: noteNames } of positions) {
      for (const noteName of noteNames) {
        const noteId = await this.upsertNote(client, noteName);

        await client.query(
          `INSERT INTO fragrance_notes (fragrance_id, note_id, position)
           VALUES ($1, $2, $3)
           ON CONFLICT (fragrance_id, note_id, position) DO NOTHING`,
          [fragranceId, noteId, position]
        );
      }
    }
  }

  private async upsertNote(client: PoolClient, name: string): Promise<number> {
    const result = await client.query(
      `INSERT INTO notes (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [name]
    );
    return result.rows[0].id;
  }

  private async savePerfumers(
    client: PoolClient,
    fragranceId: number,
    perfumerNames: string[]
  ): Promise<void> {
    await client.query('DELETE FROM fragrance_perfumers WHERE fragrance_id = $1', [fragranceId]);

    for (const name of perfumerNames) {
      const perfumerId = await this.upsertPerfumer(client, name);

      await client.query(
        `INSERT INTO fragrance_perfumers (fragrance_id, perfumer_id)
         VALUES ($1, $2)
         ON CONFLICT (fragrance_id, perfumer_id) DO NOTHING`,
        [fragranceId, perfumerId]
      );
    }
  }

  private async upsertPerfumer(client: PoolClient, name: string): Promise<number> {
    const result = await client.query(
      `INSERT INTO perfumers (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [name]
    );
    return result.rows[0].id;
  }

  private async saveAccords(
    client: PoolClient,
    fragranceId: number,
    accords: Array<{ name: string; strength: number }>
  ): Promise<void> {
    await client.query('DELETE FROM fragrance_accords WHERE fragrance_id = $1', [fragranceId]);

    for (const accord of accords) {
      const accordId = await this.upsertAccord(client, accord.name);

      await client.query(
        `INSERT INTO fragrance_accords (fragrance_id, accord_id, strength)
         VALUES ($1, $2, $3)
         ON CONFLICT (fragrance_id, accord_id)
         DO UPDATE SET strength = EXCLUDED.strength`,
        [fragranceId, accordId, accord.strength]
      );
    }
  }

  private async upsertAccord(client: PoolClient, name: string): Promise<number> {
    const result = await client.query(
      `INSERT INTO accords (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [name]
    );

    if (result.rows.length === 0) {
      const existing = await client.query('SELECT id FROM accords WHERE name = $1', [name]);
      return existing.rows[0].id;
    }

    return result.rows[0].id;
  }

  private async saveSeasons(
    client: PoolClient,
    fragranceId: number,
    seasons: Array<{ name: string; suitability: number }>
  ): Promise<void> {
    await client.query('DELETE FROM fragrance_seasons WHERE fragrance_id = $1', [fragranceId]);

    for (const season of seasons) {
      const seasonResult = await client.query(
        'SELECT id FROM seasons WHERE name = $1',
        [season.name]
      );

      if (seasonResult.rows.length > 0) {
        await client.query(
          `INSERT INTO fragrance_seasons (fragrance_id, season_id, suitability_score)
           VALUES ($1, $2, $3)
           ON CONFLICT (fragrance_id, season_id)
           DO UPDATE SET suitability_score = EXCLUDED.suitability_score`,
          [fragranceId, seasonResult.rows[0].id, season.suitability]
        );
      }
    }
  }

  private async saveOccasions(
    client: PoolClient,
    fragranceId: number,
    occasions: Array<{ name: string; suitability: number }>
  ): Promise<void> {
    await client.query('DELETE FROM fragrance_occasions WHERE fragrance_id = $1', [fragranceId]);

    for (const occasion of occasions) {
      const occasionId = await this.upsertOccasion(client, occasion.name);

      await client.query(
        `INSERT INTO fragrance_occasions (fragrance_id, occasion_id, suitability_score)
         VALUES ($1, $2, $3)
         ON CONFLICT (fragrance_id, occasion_id)
         DO UPDATE SET suitability_score = EXCLUDED.suitability_score`,
        [fragranceId, occasionId, occasion.suitability]
      );
    }
  }

  private async upsertOccasion(client: PoolClient, name: string): Promise<number> {
    const result = await client.query(
      `INSERT INTO occasions (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      [name]
    );

    if (result.rows.length === 0) {
      const existing = await client.query('SELECT id FROM occasions WHERE name = $1', [name]);
      return existing.rows[0].id;
    }

    return result.rows[0].id;
  }

  async fragranceExists(parfumoId: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM fragrances WHERE parfumo_id = $1',
      [parfumoId]
    );
    return result.rows.length > 0;
  }

  async saveCrawlHistory(history: CrawlHistory): Promise<void> {
    await query(
      `INSERT INTO crawl_history (url, status, response_code, error_message, items_extracted, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [history.url, history.status, history.responseCode, history.errorMessage, history.itemsExtracted, history.durationMs]
    );
  }
}