import axios from 'axios';
import { URL } from 'url';
import { crawlerLogger as logger } from '../utils/logger';
import { config } from '../config';

interface RobotsRule {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
  sitemap?: string[];
}

export class RobotsChecker {
  private robotsCache: Map<string, RobotsRule[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  async canFetch(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;

      const rules = await this.getRobotsRules(robotsUrl);

      // Check if URL is allowed
      const path = urlObj.pathname + urlObj.search;
      return this.isAllowed(rules, path);
    } catch (error) {
      logger.warn(`Could not check robots.txt for ${url}, proceeding cautiously`);
      // If we can't check robots.txt, be conservative and allow
      // but with increased delay
      return true;
    }
  }

  private async getRobotsRules(robotsUrl: string): Promise<RobotsRule[]> {
    // Check cache
    const cached = this.robotsCache.get(robotsUrl);
    const expiry = this.cacheExpiry.get(robotsUrl);

    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }

    try {
      // Fetch robots.txt
      const response = await axios.get(robotsUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': config.crawler.userAgent,
        },
      });

      const rules = this.parseRobotsTxt(response.data);

      // Cache the rules
      this.robotsCache.set(robotsUrl, rules);
      this.cacheExpiry.set(robotsUrl, Date.now() + this.CACHE_DURATION);

      return rules;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No robots.txt means everything is allowed
        logger.debug(`No robots.txt found for ${robotsUrl}`);
        return [];
      }
      throw error;
    }
  }

  private parseRobotsTxt(content: string): RobotsRule[] {
    const lines = content.split('\n');
    const rules: RobotsRule[] = [];
    let currentRule: RobotsRule | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip comments and empty lines
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const [directive, ...valueParts] = trimmedLine.split(':');
      const value = valueParts.join(':').trim();

      switch (directive.toLowerCase()) {
        case 'user-agent':
          if (currentRule) {
            rules.push(currentRule);
          }
          currentRule = {
            userAgent: value.toLowerCase(),
            disallow: [],
            allow: [],
            sitemap: [],
          };
          break;

        case 'disallow':
          if (currentRule && value) {
            currentRule.disallow.push(value);
          }
          break;

        case 'allow':
          if (currentRule && value) {
            currentRule.allow.push(value);
          }
          break;

        case 'crawl-delay':
          if (currentRule) {
            currentRule.crawlDelay = parseInt(value);
          }
          break;

        case 'sitemap':
          if (currentRule) {
            currentRule.sitemap = currentRule.sitemap || [];
            currentRule.sitemap.push(value);
          }
          break;
      }
    }

    if (currentRule) {
      rules.push(currentRule);
    }

    return rules;
  }

  private isAllowed(rules: RobotsRule[], path: string): boolean {
    // Find rules that apply to our user agent
    const applicableRules = rules.filter(rule => {
      return rule.userAgent === '*' ||
             config.crawler.userAgent.toLowerCase().includes(rule.userAgent);
    });

    // If no rules apply, everything is allowed
    if (applicableRules.length === 0) {
      return true;
    }

    // Check rules in order of specificity
    for (const rule of applicableRules) {
      // Check allow rules first (they take precedence)
      for (const allowPattern of rule.allow) {
        if (this.matchesPattern(path, allowPattern)) {
          logger.debug(`Path ${path} is explicitly allowed by robots.txt`);
          return true;
        }
      }

      // Check disallow rules
      for (const disallowPattern of rule.disallow) {
        if (this.matchesPattern(path, disallowPattern)) {
          logger.warn(`Path ${path} is disallowed by robots.txt`);
          return false;
        }
      }

      // Apply crawl delay if specified
      if (rule.crawlDelay) {
        logger.info(`Robots.txt specifies crawl delay of ${rule.crawlDelay} seconds`);
        // This should be handled by the rate limiter
      }
    }

    return true;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Simple pattern matching (robots.txt uses simple wildcards)
    // Convert pattern to regex
    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    // Patterns ending with $ must match exactly
    if (!pattern.endsWith('$')) {
      regexPattern = `^${regexPattern}`;
    } else {
      regexPattern = `^${regexPattern.slice(0, -1)}$`;
    }

    return new RegExp(regexPattern).test(path);
  }

  getCrawlDelay(url: string): number | null {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;

      const rules = this.robotsCache.get(robotsUrl);
      if (!rules) return null;

      const applicableRule = rules.find(rule => {
        return rule.userAgent === '*' ||
               config.crawler.userAgent.toLowerCase().includes(rule.userAgent);
      });

      return applicableRule?.crawlDelay || null;
    } catch {
      return null;
    }
  }
}