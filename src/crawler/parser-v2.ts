import * as cheerio from 'cheerio';
import { CrawlResult, Fragrance, Brand } from '../types';
import { parserLogger as logger } from '../utils/logger';
import { config } from '../config';

export class FragranceParserV2 {

  parseFragrancePage(html: string, url: string): CrawlResult | null {
    try {
      const $ = cheerio.load(html);

      // Updated selectors based on actual Parfumo structure
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
      logger.error(`Failed to parse fragrance page: ${url} - ${error}`);
      return null;
    }
  }

  private extractParfumoId(url: string): string {
    // Extract from URL pattern: /Perfumes/Brand/Fragrance-Name
    const match = url.match(/\/Perfumes\/[^\/]+\/([^\/\?]+)/);
    return match ? match[1] : url.split('/').pop() || '';
  }

  private extractName($: cheerio.Root): string {
    // Multiple possible selectors for fragrance name
    return $('h1[itemprop="name"]').text().trim() ||
           $('h1.p_name_h1').text().trim() ||
           $('.fragrance-name').text().trim() ||
           $('h1').first().text().trim() ||
           'Unknown';
  }

  private extractBrand($: cheerio.Root): Brand {
    const brandName = $('span[itemprop="brand"] span[itemprop="name"]').text().trim() ||
                     $('span[itemprop="brand"]').text().trim() ||
                     $('.brand-name').text().trim() ||
                     $('a[href*="/Brands/"]').first().text().trim() ||
                     'Unknown';

    return { name: brandName };
  }

  private extractReleaseYear($: cheerio.Root): number | undefined {
    const yearText = $('.release-year').text() ||
                    $('span:contains("Release year")').parent().find('.data').text() ||
                    $('span:contains("Launch Year")').next().text() ||
                    $('div.launch_year').text();

    const year = parseInt(yearText.match(/\d{4}/)?.[0] || '');
    return isNaN(year) ? undefined : year;
  }

  private extractGender($: cheerio.Root): string | undefined {
    const genderText = $('.gender').text().trim() ||
                      $('span:contains("Gender")').parent().find('.data').text().trim() ||
                      $('[itemprop="gender"]').text().trim() ||
                      $('.for_gender').text().trim();

    return genderText || undefined;
  }

  private extractFragranceType($: cheerio.Root): string | undefined {
    const typeText = $('.fragrance-type').text().trim() ||
                    $('span:contains("Type")').parent().find('.data').text().trim() ||
                    $('[itemprop="category"]').text().trim();

    return typeText || undefined;
  }

  private extractConcentration($: cheerio.Root): string | undefined {
    const concText = $('.concentration').text().trim() ||
                    $('span:contains("Concentration")').parent().find('.data').text().trim() ||
                    $('span:contains("Strength")').next().text().trim();

    return concText || undefined;
  }

  private extractDescription($: cheerio.Root): string | undefined {
    const descText = $('[itemprop="description"]').text().trim() ||
                    $('.fragrance-description').text().trim() ||
                    $('.p_desc').text().trim() ||
                    $('.description').first().text().trim();

    return descText ? descText.substring(0, 5000) : undefined;
  }

  private extractRatings($: cheerio.Root): {
    value?: number;
    count?: number;
    longevity?: number;
    sillage?: number;
  } {
    const ratings: any = {};

    // Main rating
    const ratingValue = $('[itemprop="ratingValue"]').attr('content') ||
                       $('.rating-value').text() ||
                       $('.average-rating').text() ||
                       $('.rating_big_alt').text();

    if (ratingValue) {
      const parsed = parseFloat(ratingValue.replace(',', '.'));
      if (!isNaN(parsed)) ratings.value = parsed;
    }

    // Vote count
    const ratingCount = $('[itemprop="ratingCount"]').attr('content') ||
                       $('.rating-count').text() ||
                       $('.votes-count').text();

    if (ratingCount) {
      const parsed = parseInt(ratingCount.replace(/\D/g, ''));
      if (!isNaN(parsed)) ratings.count = parsed;
    }

    // Longevity rating
    const longevityText = $('.longevity .rating').text() ||
                         $('div:contains("Longevity")').find('.rating').text();
    if (longevityText) {
      const parsed = parseFloat(longevityText.replace(',', '.'));
      if (!isNaN(parsed)) ratings.longevity = parsed;
    }

    // Sillage rating
    const sillageText = $('.sillage .rating').text() ||
                       $('div:contains("Sillage")').find('.rating').text();
    if (sillageText) {
      const parsed = parseFloat(sillageText.replace(',', '.'));
      if (!isNaN(parsed)) ratings.sillage = parsed;
    }

    return ratings;
  }

  private extractNotes($: cheerio.Root): {
    top: string[];
    middle: string[];
    base: string[];
  } {
    const notes = {
      top: [] as string[],
      middle: [] as string[],
      base: [] as string[],
    };

    // Look for pyramid structure
    $('.pyramid .pyramid-level, .notes-pyramid .level').each((_, element) => {
      const $element = $(element);
      const levelName = $element.find('.level-name, .pyramid-top, .pyramid-heart, .pyramid-base').text().toLowerCase();
      const noteElements = $element.find('.note a, a[href*="/Notes/"]');

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

    // Alternative structure
    if (notes.top.length === 0 && notes.middle.length === 0 && notes.base.length === 0) {
      $('.main-notes a, .notes a').each((_, el) => {
        const noteText = $(el).text().trim();
        if (noteText) notes.middle.push(noteText);
      });
    }

    return notes;
  }

  private extractPerfumers($: cheerio.Root): string[] {
    const perfumers: string[] = [];

    $('.perfumer a, a[href*="/Noses/"]').each((_, element) => {
      const name = $(element).text().trim();
      if (name && !perfumers.includes(name)) {
        perfumers.push(name);
      }
    });

    return perfumers;
  }

  private extractAccords($: cheerio.Root): Array<{ name: string; strength: number }> {
    const accords: Array<{ name: string; strength: number }> = [];

    $('.accords .accord').each((_, element) => {
      const $element = $(element);
      const name = $element.find('.accord-name').text().trim() ||
                  $element.text().trim();

      const styleWidth = $element.attr('style')?.match(/width:\s*(\d+)%/)?.[1];
      const strength = parseInt(styleWidth || '50');

      if (name && !name.includes('%')) {
        accords.push({ name, strength: isNaN(strength) ? 50 : strength });
      }
    });

    return accords;
  }

  private extractSeasons($: cheerio.Root): Array<{ name: string; suitability: number }> {
    const seasons: Array<{ name: string; suitability: number }> = [];

    $('.season-ratings .season').each((_, element) => {
      const $element = $(element);
      const name = $element.find('.season-name').text().toLowerCase().trim();
      const rating = parseInt($element.find('.rating').text() || '50');

      if (name && ['spring', 'summer', 'fall', 'autumn', 'winter'].includes(name)) {
        seasons.push({
          name: name === 'autumn' ? 'fall' : name,
          suitability: rating,
        });
      }
    });

    return seasons;
  }

  private extractOccasions($: cheerio.Root): Array<{ name: string; suitability: number }> {
    const occasions: Array<{ name: string; suitability: number }> = [];

    $('.occasions .occasion').each((_, element) => {
      const $element = $(element);
      const name = $element.find('.occasion-name').text().trim();
      const rating = parseInt($element.find('.rating').text() || '70');

      if (name) {
        occasions.push({
          name,
          suitability: rating,
        });
      }
    });

    return occasions;
  }

  /**
   * Parse search results page to extract fragrance URLs
   * Updated for actual Parfumo search page structure
   */
  parseSearchResultsPage(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    // Main grid/list view items
    $('a[href*="/Perfumes/"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && href.includes('/Perfumes/') && !href.includes('s_perfumes')) {
        const fullUrl = href.startsWith('http') ? href : `${config.crawler.baseUrl}${href}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    });

    logger.info(`Found ${urls.length} fragrance URLs on search page`);
    return urls;
  }

  /**
   * Extract pagination info from search results
   */
  extractPaginationInfo(html: string): { currentPage: number; totalPages: number; hasNext: boolean } {
    const $ = cheerio.load(html);

    // Look for pagination elements
    const currentPage = parseInt($('.pagination .current').text() || '1');
    const lastPageLink = $('.pagination a:last').attr('href');
    const totalPages = lastPageLink ? parseInt(lastPageLink.match(/current_page=(\d+)/)?.[1] || '1') : 1;
    const hasNext = $('.pagination .next').length > 0;

    return { currentPage, totalPages, hasNext };
  }
}