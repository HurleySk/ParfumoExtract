import * as cheerio from 'cheerio';
import { CrawlResult, Fragrance, Brand } from '../types';
import { parserLogger as logger } from '../utils/logger';

export class FragranceParser {

  parseFragrancePage(html: string, url: string): CrawlResult | null {
    try {
      const $ = cheerio.load(html);

      const parfumoId = this.extractParfumoId(url);
      const name = this.extractName($);
      const brand = this.extractBrand($);
      const releaseYear = this.extractReleaseYear($);
      const gender = this.extractGender($);
      const fragranceType = this.extractFragranceType($);
      const concentration = this.extractConcentration($);
      const description = this.extractDescription($);
      const ratings = this.extractRatings($);
      const notes = this.extractNotes($);
      const perfumers = this.extractPerfumers($);
      const accords = this.extractAccords($);
      const seasons = this.extractSeasons($);
      const occasions = this.extractOccasions($);

      const fragrance: Fragrance = {
        parfumoId,
        name,
        releaseYear,
        gender,
        fragranceType,
        concentration,
        description,
        ratingValue: ratings.value,
        ratingCount: ratings.count,
        longevityRating: ratings.longevity,
        sillageRating: ratings.sillage,
        url,
        lastCrawled: new Date(),
      };

      return {
        fragrance,
        brand,
        notes,
        perfumers,
        accords,
        seasons,
        occasions,
      };
    } catch (error) {
      logger.error(`Failed to parse fragrance page: ${url}`, error);
      return null;
    }
  }

  private extractParfumoId(url: string): string {
    const match = url.match(/\/([^\/]+)\.html$/);
    return match ? match[1] : url.split('/').pop() || '';
  }

  private extractName($: cheerio.CheerioAPI): string {
    return $('h1[itemprop="name"]').text().trim() ||
           $('h1.fragrance-name').text().trim() ||
           $('h1').first().text().trim() ||
           'Unknown';
  }

  private extractBrand($: cheerio.CheerioAPI): Brand {
    const brandName = $('span[itemprop="brand"]').text().trim() ||
                     $('.brand-name').text().trim() ||
                     $('a[href*="/brand/"]').first().text().trim() ||
                     'Unknown';

    return { name: brandName };
  }

  private extractReleaseYear($: cheerio.CheerioAPI): number | undefined {
    const yearText = $('.release-year').text() ||
                    $('span:contains("Launch Year")').next().text() ||
                    $('span:contains("Released")').next().text();

    const year = parseInt(yearText.match(/\d{4}/)?.[0] || '');
    return isNaN(year) ? undefined : year;
  }

  private extractGender($: cheerio.CheerioAPI): string | undefined {
    const genderText = $('.gender').text().trim() ||
                      $('span:contains("Gender")').next().text().trim() ||
                      $('[itemprop="gender"]').text().trim();

    return genderText || undefined;
  }

  private extractFragranceType($: cheerio.CheerioAPI): string | undefined {
    const typeText = $('.fragrance-type').text().trim() ||
                    $('span:contains("Type")').next().text().trim() ||
                    $('[itemprop="category"]').text().trim();

    return typeText || undefined;
  }

  private extractConcentration($: cheerio.CheerioAPI): string | undefined {
    const concText = $('.concentration').text().trim() ||
                    $('span:contains("Concentration")').next().text().trim() ||
                    $('span:contains("Strength")').next().text().trim();

    return concText || undefined;
  }

  private extractDescription($: cheerio.CheerioAPI): string | undefined {
    const descText = $('[itemprop="description"]').text().trim() ||
                    $('.fragrance-description').text().trim() ||
                    $('.description').first().text().trim();

    return descText ? descText.substring(0, 5000) : undefined;
  }

  private extractRatings($: cheerio.CheerioAPI): {
    value?: number;
    count?: number;
    longevity?: number;
    sillage?: number;
  } {
    const ratings: any = {};

    const ratingValue = $('[itemprop="ratingValue"]').text() ||
                       $('.rating-value').text() ||
                       $('.average-rating').text();

    if (ratingValue) {
      const parsed = parseFloat(ratingValue.replace(',', '.'));
      if (!isNaN(parsed)) ratings.value = parsed;
    }

    const ratingCount = $('[itemprop="ratingCount"]').text() ||
                       $('.rating-count').text() ||
                       $('.votes-count').text();

    if (ratingCount) {
      const parsed = parseInt(ratingCount.replace(/\D/g, ''));
      if (!isNaN(parsed)) ratings.count = parsed;
    }

    const longevityText = $('span:contains("Longevity")').parent().find('.rating-bar').attr('data-value') ||
                         $('span:contains("Longevity")').next('.rating').text();
    if (longevityText) {
      const parsed = parseFloat(longevityText.replace(',', '.'));
      if (!isNaN(parsed)) ratings.longevity = parsed;
    }

    const sillageText = $('span:contains("Sillage")').parent().find('.rating-bar').attr('data-value') ||
                       $('span:contains("Sillage")').next('.rating').text();
    if (sillageText) {
      const parsed = parseFloat(sillageText.replace(',', '.'));
      if (!isNaN(parsed)) ratings.sillage = parsed;
    }

    return ratings;
  }

  private extractNotes($: cheerio.CheerioAPI): {
    top: string[];
    middle: string[];
    base: string[];
  } {
    const notes = {
      top: [] as string[],
      middle: [] as string[],
      base: [] as string[],
    };

    $('.pyramid-level, .notes-section').each((_, element) => {
      const $element = $(element);
      const levelName = $element.find('.level-name, h3').text().toLowerCase();
      const noteElements = $element.find('.note-name, .note, a[href*="/note/"]');

      const noteNames = noteElements.map((_, el) => $(el).text().trim()).get()
        .filter(name => name.length > 0);

      if (levelName.includes('top') || levelName.includes('head')) {
        notes.top.push(...noteNames);
      } else if (levelName.includes('middle') || levelName.includes('heart')) {
        notes.middle.push(...noteNames);
      } else if (levelName.includes('base') || levelName.includes('bottom')) {
        notes.base.push(...noteNames);
      }
    });

    if (notes.top.length === 0 && notes.middle.length === 0 && notes.base.length === 0) {
      $('.notes a, .fragrance-notes a').each((_, el) => {
        const noteText = $(el).text().trim();
        if (noteText) notes.middle.push(noteText);
      });
    }

    return notes;
  }

  private extractPerfumers($: cheerio.CheerioAPI): string[] {
    const perfumers: string[] = [];

    $('.perfumer-name, a[href*="/perfumer/"], span:contains("Perfumer")').each((_, element) => {
      const $element = $(element);
      let name = '';

      if ($element.is('a')) {
        name = $element.text().trim();
      } else if ($element.is('span')) {
        name = $element.next().text().trim();
      } else {
        name = $element.text().trim();
      }

      if (name && name !== 'Perfumer' && !perfumers.includes(name)) {
        perfumers.push(name);
      }
    });

    return perfumers;
  }

  private extractAccords($: cheerio.CheerioAPI): Array<{ name: string; strength: number }> {
    const accords: Array<{ name: string; strength: number }> = [];

    $('.accord-bar, .accord').each((_, element) => {
      const $element = $(element);
      const name = $element.find('.accord-name').text().trim() ||
                  $element.text().trim();

      const strengthText = $element.find('.accord-strength').text() ||
                          $element.attr('data-strength') ||
                          $element.attr('style')?.match(/width:\s*(\d+)%/)?.[1];

      const strength = parseInt(strengthText || '50');

      if (name && !name.includes('%')) {
        accords.push({ name, strength: isNaN(strength) ? 50 : strength });
      }
    });

    return accords;
  }

  private extractSeasons($: cheerio.CheerioAPI): Array<{ name: string; suitability: number }> {
    const seasons: Array<{ name: string; suitability: number }> = [];
    const seasonNames = ['spring', 'summer', 'fall', 'autumn', 'winter'];

    $('.season-rating, .seasons').each((_, element) => {
      const $element = $(element);
      const text = $element.text().toLowerCase();

      seasonNames.forEach(season => {
        if (text.includes(season)) {
          const ratingMatch = text.match(new RegExp(`${season}[^0-9]*(\\d+)`));
          const rating = ratingMatch ? parseInt(ratingMatch[1]) : 60;

          if (!seasons.find(s => s.name === (season === 'autumn' ? 'fall' : season))) {
            seasons.push({
              name: season === 'autumn' ? 'fall' : season,
              suitability: rating,
            });
          }
        }
      });
    });

    return seasons;
  }

  private extractOccasions($: cheerio.CheerioAPI): Array<{ name: string; suitability: number }> {
    const occasions: Array<{ name: string; suitability: number }> = [];

    $('.occasion-rating, .occasions, .usage').each((_, element) => {
      const $element = $(element);
      const items = $element.find('span, li, a');

      items.each((_, item) => {
        const text = $(item).text().trim();
        const ratingText = $(item).attr('data-rating') || '70';
        const rating = parseInt(ratingText);

        if (text && !occasions.find(o => o.name === text)) {
          occasions.push({
            name: text,
            suitability: isNaN(rating) ? 70 : rating,
          });
        }
      });
    });

    return occasions;
  }

  parseListPage(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    $('a[href*="/perfume/"], a[href*="/fragrance/"], .fragrance-link').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `${config.crawler.baseUrl}${href}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    });

    logger.info(`Found ${urls.length} fragrance URLs on list page`);
    return urls;
  }
}