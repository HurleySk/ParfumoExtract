import * as cheerio from 'cheerio';
import { CrawlResult, Fragrance, Brand } from '../types';
import { parserLogger as logger } from '../utils/logger';
import { config } from '../config';

export class FragranceParserV3 {

  parseFragrancePage(html: string, url: string): CrawlResult | null {
    try {
      const $ = cheerio.load(html);

      // Extract all data with improved selectors
      const parfumoId = this.extractParfumoId(url);
      const nameData = this.extractNameAndYear($);
      const brand = this.extractBrand($);
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
        name: nameData.name,
        releaseYear: nameData.year,
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
    const match = url.match(/\/Perfumes\/[^\/]+\/([^\/\?]+)/);
    return match ? match[1] : url.split('/').pop() || '';
  }

  private extractNameAndYear($: cheerio.Root): { name: string; year?: number } {
    // H1 often contains "Name Brand Year" format
    const h1Text = $('h1').first().text().trim();

    // Try to extract year from H1
    const yearMatch = h1Text.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : undefined;

    // Clean name - remove brand and year
    let name = h1Text;
    if (yearMatch) {
      name = name.replace(yearMatch[0], '').trim();
    }

    // Also remove brand name if it's at the end
    const brandName = this.extractBrand($).name;
    if (name.endsWith(brandName)) {
      name = name.slice(0, -(brandName.length)).trim();
    }

    return { name: name || 'Unknown', year };
  }

  private extractBrand($: cheerio.Root): Brand {
    const brandName = $('[itemprop="brand"] [itemprop="name"]').text().trim() ||
                     $('[itemprop="brand"]').text().trim() ||
                     $('.brand_in_header').text().trim() ||
                     $('.brand-name').text().trim() ||
                     $('a[href*="/Brands/"]').first().text().trim() ||
                     'Unknown';

    return { name: brandName };
  }

  private extractGender($: cheerio.Root): string | undefined {
    // Look for gender in description or dedicated element
    const descText = $('[itemprop="description"]').text();

    if (descText.includes('women and men') || descText.includes('unisex')) {
      return 'Unisex';
    } else if (descText.includes('for women')) {
      return 'Women';
    } else if (descText.includes('for men')) {
      return 'Men';
    }

    const genderText = $('.gender_text').text().trim() ||
                      $('[itemprop="gender"]').text().trim() ||
                      $('.for_gender').text().trim();

    return genderText || undefined;
  }

  private extractFragranceType($: cheerio.Root): string | undefined {
    // Extract concentration from title or specific elements
    const h1Text = $('h1').text();
    const concentrations = ['Eau de Parfum', 'Eau de Toilette', 'Parfum', 'Extrait', 'Cologne', 'Eau de Cologne'];

    for (const conc of concentrations) {
      if (h1Text.includes(conc)) {
        return conc;
      }
    }

    const typeText = $('.fragrance-type').text().trim() ||
                    $('[itemprop="category"]').text().trim();

    return typeText || undefined;
  }

  private extractConcentration($: cheerio.Root): string | undefined {
    // Same as fragrance type for Parfumo
    return this.extractFragranceType($);
  }

  private extractDescription($: cheerio.Root): string | undefined {
    const descText = $('[itemprop="description"]').text().trim() ||
                    $('.fragrance_description').text().trim() ||
                    $('.p_desc').text().trim() ||
                    $('meta[name="description"]').attr('content');

    return descText ? descText.substring(0, 5000) : undefined;
  }

  private extractRatings($: cheerio.Root): {
    value?: number;
    count?: number;
    longevity?: number;
    sillage?: number;
  } {
    const ratings: any = {};

    // Main rating - look for aggregateRating schema.org markup
    const ratingValue = $('[itemprop="aggregateRating"] [itemprop="ratingValue"]').text().trim() ||
                       $('.ratingvalue').text().trim() ||
                       $('.rating_big_alt').text().trim();

    if (ratingValue) {
      const parsed = parseFloat(ratingValue.replace(',', '.'));
      if (!isNaN(parsed)) ratings.value = parsed;
    }

    // Vote count
    const ratingCount = $('[itemprop="aggregateRating"] [itemprop="ratingCount"]').text().trim() ||
                       $('.rating_count').text().trim();

    if (ratingCount) {
      // Remove "Ratings" text and parse number
      const parsed = parseInt(ratingCount.replace(/\D/g, ''));
      if (!isNaN(parsed)) ratings.count = parsed;
    }

    // Extract specific ratings from barfiller elements using data attributes
    $('.barfiller_element').each((_, element) => {
      const $element = $(element);
      const type = $element.attr('data-type');
      const totalVotings = $element.attr('data-total_votings');

      if (totalVotings) {
        const value = parseFloat(totalVotings) / 10; // Convert to 0-10 scale

        switch(type) {
          case 'scent':
            ratings.value = ratings.value || value; // Use as main rating if not already set
            break;
          case 'durability':
            ratings.longevity = value;
            break;
          case 'sillage':
            ratings.sillage = value;
            break;
        }
      }
    });

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

    // Extract notes from pyramid blocks with correct structure
    $('.pyramid_block').each((_, element) => {
      const $block = $(element);
      const classNames = $block.attr('class') || '';

      // Extract note names from images within clickable_note_img spans
      $block.find('.clickable_note_img img').each((_, img) => {
        const noteName = $(img).attr('alt');
        if (noteName && noteName.length > 0) {
          // Determine position based on parent block class
          if (classNames.includes('nb_t')) {
            notes.top.push(noteName);
          } else if (classNames.includes('nb_m')) {
            notes.middle.push(noteName);
          } else if (classNames.includes('nb_b')) {
            notes.base.push(noteName);
          }
        }
      });
    });

    // Fallback: try text content if no images found
    if (notes.top.length === 0 && notes.middle.length === 0 && notes.base.length === 0) {
      $('.pyramid_block').each((_, element) => {
        const $block = $(element);
        const classNames = $block.attr('class') || '';
        const text = $block.text();

        // Extract position from text
        let position = 'middle';
        if (text.toLowerCase().includes('top') || classNames.includes('nb_t')) {
          position = 'top';
        } else if (text.toLowerCase().includes('heart') || classNames.includes('nb_m')) {
          position = 'middle';
        } else if (text.toLowerCase().includes('base') || classNames.includes('nb_b')) {
          position = 'base';
        }

        // Extract note names from text
        $block.find('.clickable_note_img').each((_, span) => {
          const noteText = $(span).text().trim();
          if (noteText && noteText.length > 0 && !noteText.includes('Notes')) {
            if (position === 'top') notes.top.push(noteText);
            else if (position === 'middle') notes.middle.push(noteText);
            else if (position === 'base') notes.base.push(noteText);
          }
        });
      });
    }

    return notes;
  }

  private extractPerfumers($: cheerio.Root): string[] {
    const perfumers: string[] = [];

    $('.perfumer a, a[href*="/Noses/"], .nose_name').each((_, element) => {
      const name = $(element).text().trim();
      if (name && !perfumers.includes(name)) {
        perfumers.push(name);
      }
    });

    return perfumers;
  }

  private extractAccords($: cheerio.Root): Array<{ name: string; strength: number }> {
    const accords: Array<{ name: string; strength: number }> = [];

    // Main accords from bar visualization
    $('.main_accords_bar .accords_block, .accord_element').each((_, element) => {
      const $element = $(element);
      const name = $element.text().trim();

      // Try to extract strength from width style
      const style = $element.attr('style');
      let strength = 50; // Default

      if (style) {
        const widthMatch = style.match(/width:\s*(\d+)/);
        if (widthMatch) {
          strength = parseInt(widthMatch[1]);
        }
      }

      if (name && !accords.find(a => a.name === name)) {
        accords.push({ name, strength });
      }
    });

    // Alternative: Look for accords in text format
    if (accords.length === 0) {
      const accordsText = $('.main_accords').text() || $('.accords').text();
      const accordNames = ['Sweet', 'Spicy', 'Woody', 'Fresh', 'Citrus', 'Floral',
                          'Fruity', 'Gourmand', 'Aromatic', 'Green', 'Powdery',
                          'Animalic', 'Smoky', 'Leather', 'Aquatic'];

      accordNames.forEach(name => {
        if (accordsText.toLowerCase().includes(name.toLowerCase())) {
          accords.push({ name, strength: 50 });
        }
      });
    }

    return accords;
  }

  private extractSeasons(_$: cheerio.Root): Array<{ name: string; suitability: number }> {
    // Seasons might not be on main page, return empty for now
    // Could be enhanced with additional page scraping
    return [];
  }

  private extractOccasions(_$: cheerio.Root): Array<{ name: string; suitability: number }> {
    // Occasions might not be on main page, return empty for now
    // Could be enhanced with additional page scraping
    return [];
  }

  /**
   * Parse search results page
   */
  parseSearchResultsPage(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];

    // Extract links to individual fragrances, avoiding brand overview pages
    $('a[href*="/Perfumes/"]').each((_, element) => {
      const href = $(element).attr('href');

      if (href && href.includes('/Perfumes/')) {
        // Skip if it's just a brand page (only 2 segments after /Perfumes/)
        const segments = href.split('/').filter(s => s.length > 0);
        const perfumesIndex = segments.indexOf('Perfumes');

        // Must have brand AND fragrance name (3 segments minimum after domain)
        if (perfumesIndex >= 0 && segments.length > perfumesIndex + 2) {
          const fullUrl = href.startsWith('http') ? href : `${config.crawler.baseUrl}${href}`;
          if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
          }
        }
      }
    });

    logger.info(`Found ${urls.length} fragrance URLs on search page`);
    return urls;
  }

  extractPaginationInfo(html: string): { currentPage: number; totalPages: number; hasNext: boolean } {
    const $ = cheerio.load(html);

    const currentPage = parseInt($('.pagination .current').text() || '1');
    const lastPageLink = $('.pagination a:last').attr('href');
    const totalPages = lastPageLink ? parseInt(lastPageLink.match(/current_page=(\d+)/)?.[1] || '1') : 1;
    const hasNext = $('.pagination .next').length > 0;

    return { currentPage, totalPages, hasNext };
  }
}